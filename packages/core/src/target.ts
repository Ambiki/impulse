import type { TargetDeclaration } from './decorators/target';
import type { ImpulseElement } from './element';
import type { Token, TokenListWatcherDelegate } from './observers/token_list_watcher';
import SetMap from './data_structures/set_map';
import { invokeReporting, reportUncaught } from './helpers/errors';
import { capitalize } from './helpers/string';
import { currentDelivery, isDelivering, undeliveredVersion, whileDelivering } from './observers/document_observer';
import TokenRouter from './observers/token_router';
import { registeredFor, TARGETS } from './registry';
import { parseTargetDescriptor } from './target_descriptor';

// One document-wide `[data-target]` watcher for every instance; tokens are routed to the instance named by the
// `identifier.key` descriptor.
const router = new TokenRouter('data-target', (content) => parseTargetDescriptor(content).identifier);

function sameElements(a: readonly Element[], b: readonly Element[]): boolean {
  return a.length === b.length && a.every((element, index) => element === b[index]);
}

// Two waiting tokens can sit on one element, and a comparator has to call a node equal to itself.
function byDocumentOrder(a: Node, b: Node): number {
  if (a === b) return 0;
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

export default class Target<T extends Element> implements TokenListWatcherDelegate<T> {
  private readonly declarations: ReadonlyMap<string, TargetDeclaration>;
  private targetsByKey: SetMap<string, T>;
  // Every matched token per element, so duplicate descriptors (`x.a x.a`) are counted and the target is only
  // unregistered once the last token referencing it goes away.
  private tokensByElement: SetMap<T, Token<T>>;
  // The tokens naming a `@target()` key that already has a target. Their elements are not in the field and have had
  // no `[key]Connected`; one of them is adopted when the target goes away, so a replacement inserted before the element
  // it replaces is removed is not lost.
  private waitingByKey: SetMap<string, Token<T>>;
  // The `@targets()` fields' values, sorted on first read after a change and handed out until the next one.
  private orderedByKey = new Map<string, T[]>();
  // What each field read while DOM changes waited to be delivered, worked out from the DOM, with the
  // `undeliveredVersion()` it holds for. Reused until more changes are waiting.
  private nowByKey = new Map<string, { version: number; value: T[] | T | null }>();
  // The array each `@targets()` field last handed out (see `share`).
  private sharedByKey = new Map<string, T[]>();
  // The delivery each `@target()` key's Target was connected in (see `takesOver`).
  private connectedDuring = new Map<string, number>();
  private stopWatching?: () => void;

  constructor(private readonly instance: ImpulseElement) {
    this.declarations = registeredFor(this.instance, TARGETS);
    this.targetsByKey = new SetMap();
    this.tokensByElement = new SetMap();
    this.waitingByKey = new SetMap();
  }

  start() {
    // Each field reads its Targets when accessed: all of them in document order (an empty array when there are none)
    // for `@targets()`, or the one (`null` when there is none) for `@target()`. While DOM changes wait to be delivered,
    // the index is behind, so the field is worked out from the DOM instead, and the callbacks still run when the
    // changes are delivered (docs/adr/0006).
    for (const { key, multiple } of this.declarations.values()) {
      const read = multiple ?
        { delivered: () => this.orderedTargets(key), now: () => this.share(key, this.claimants(key)) } :
        { delivered: () => this.targetsByKey.valuesForKey(key)[0] ?? null, now: () => this.claimantNow(key) };
      Object.defineProperty(this.instance, key, {
        configurable: true,
        get: () => {
          if (!this.stopWatching) {
            // Not subscribed: starting (its tokens being replayed), or torn down, either removed or moved and not yet
            // initialized again. A moved element still has its targets in the DOM though the index has none, so it
            // reads them there. While its tokens are replayed or torn down, it reads what has been delivered.
            return this.instance.isConnected && !isDelivering() ? read.now() : read.delivered();
          }
          const version = undeliveredVersion();
          if (version) return this.readNow(key, version, read.now);
          if (this.nowByKey.size > 0) this.nowByKey.clear();
          return read.delivered();
        },
      });
    }

    if (!this.stopWatching) {
      this.stopWatching = router.subscribe(this.instance, this);
    }
  }

  stop() {
    const stopWatching = this.stopWatching;
    if (!stopWatching) return;
    // Reset first so a throwing stop cannot block `start()` from creating a fresh watcher on reconnect, and so
    // `adoptWaiting` can tell the unmatches that follow are a teardown.
    this.stopWatching = undefined;
    this.nowByKey.clear();
    try {
      stopWatching();
    } finally {
      // Dropped once the teardown's callbacks have read their last, so removed elements are not kept alive.
      this.sharedByKey.clear();
      this.connectedDuring.clear();
    }
  }

  tokenMatched(token: Token<T>) {
    const { content, element } = token;
    const { identifier, key } = parseTargetDescriptor(content);
    // The router only delivers tokens whose closest `identifier` ancestor is this instance, so no scope check is
    // needed here. `isValidIdKeyPair` still rejects tokens routed here by a selector other than this tag name.
    if (!this.isValidIdKeyPair(identifier, key)) return;

    if (this.targetsByKey.has(key, element)) {
      this.tokensByElement.add(element, token);
      return;
    }

    // A `@target()` key holds one element. A second one is kept waiting rather than dropped; `targetsByKey` is left
    // alone, so the field and the callbacks only ever see the target.
    const [target] = this.isKeyMultiple(key) ? [] : this.targetsByKey.valuesForKey(key);
    if (target) {
      if (this.takesOver(key, element, target)) {
        this.tokensByElement.add(element, token);
        this.handOver(key, target, element);
        return;
      }
      this.waitingByKey.add(key, token);
      this.reportIfLeftWaiting(key, token);
      return;
    }

    this.tokensByElement.add(element, token);
    this.connect(key, element);
  }

  tokenUnmatched(token: Token<T>) {
    const { content, element } = token;
    const { identifier, key } = parseTargetDescriptor(content);
    if (!this.isValidIdKeyPair(identifier, key)) return;
    // A waiting token's element never had a `[key]Connected`, so it goes without a `[key]Disconnected`.
    if (this.waitingByKey.delete(key, token)) return;
    if (!this.targetsByKey.has(key, element)) return;

    this.tokensByElement.delete(element, token);
    if (this.isStillReferenced(element, content)) return;

    // The callback still sees the target in the field; it is forgotten afterwards, even if the callback throws.
    try {
      this.invokeCallback(key, element, 'disconnected');
    } finally {
      this.targetsByKey.delete(key, element);
      this.orderedByKey.delete(key);
      this.adoptWaiting(key, token);
    }
  }

  /**
   * Reports a second element for a `@target()` key, unless it has stopped waiting by the time every token delivered
   * along with it has been processed. Replacing a target by inserting the new element before removing the old one
   * passes through two elements without being a mistake. Two that are both still there afterwards are one.
   *
   * Tokens arrive in synchronous runs: a mutation batch, or the replay when the instance starts. A microtask queued
   * from inside a run is therefore invoked once every token in it has been delivered.
   */
  private reportIfLeftWaiting(key: string, token: Token<T>) {
    Promise.resolve().then(() => {
      if (!this.waitingByKey.has(key, token)) return;

      reportUncaught(
        new Error(
          `
Multiple "${key}" targets in the "${this.identifier}" element were defined using the @target() decorator.
Please use the @targets() decorator instead if you want to define multiple targets for the same key.
Learn more about the @targets() decorator: https://ambiki.github.io/impulse/reference/targets.html#multiple-targets
          `.trim(),
        ),
      );
    });
  }

  private connect(key: string, element: T) {
    this.targetsByKey.add(key, element);
    this.orderedByKey.delete(key);
    if (!this.isKeyMultiple(key)) this.connectedDuring.set(key, currentDelivery());
    this.invokeCallback(key, element, 'connected');
  }

  /**
   * Whether `element`, claiming a `@target()` key whose Target is `target`, takes the key from it. A read made before
   * this delivery, while the key had no Target or was losing it, took the first claimant in document order
   * (`claimantNow`), so a Target connected earlier in the same delivery gives way to a claimant ahead of it. A Target
   * from an earlier delivery keeps the key, and the claimant waits behind it.
   */
  private takesOver(key: string, element: T, target: T): boolean {
    return (
      this.connectedDuring.get(key) === currentDelivery() &&
      byDocumentOrder(element, target) < 0 &&
      this.claims(element, key) &&
      this.claims(target, key)
    );
  }

  /**
   * Makes `element` the Target of a `@target()` key in place of `target`, which waits behind it as a second claimant
   * does: `[key]Disconnected` for `target`, then `[key]Connected` for `element`.
   */
  private handOver(key: string, target: T, element: T) {
    try {
      this.invokeCallback(key, target, 'disconnected');
    } finally {
      this.targetsByKey.delete(key, target);
      const tokens = this.tokensByElement
        .valuesForKey(target)
        .filter((token) => parseTargetDescriptor(token.content).key === key);
      for (const token of tokens) {
        this.tokensByElement.delete(target, token);
        this.waitingByKey.add(key, token);
      }
      if (tokens[0]) this.reportIfLeftWaiting(key, tokens[0]);
      // Reported rather than thrown, as in `adoptWaiting`: it can run while a throwing `[key]Disconnected` unwinds.
      invokeReporting(() => this.connect(key, element));
    }
  }

  /**
   * Adopts the first waiting element in document order as the target of a `@target()` key that has just lost its own,
   * invoking `[key]Connected` for it. `departed` is the token whose unmatch freed the key.
   *
   * A token is only dropped when its own unmatch is delivered, and a mutation batch delivers them one record at a
   * time, so what has been delivered can be behind the document. The router is asked what the document says now:
   *
   * - The target may have been moved rather than removed. Its token is unmatched here and matched again by the record
   *   that follows, so it is left to come back rather than replaced.
   * - A waiting element may already be detached, sit under another owner, or have had the descriptor rewritten out of
   *   its attribute, with the unmatch saying so queued behind this one. Adopting it would invoke `[key]Connected` for
   *   an element that is about to be forgotten.
   */
  private adoptWaiting(key: string, departed?: Token<T>) {
    // Nothing is waiting behind almost every target that goes away, `@targets()` ones included. While stopping,
    // `stop()` has cleared `stopWatching` and is unmatching every token, the waiting ones too, so there is nobody to
    // adopt. And on the second look below, the key may have a target again.
    if (!this.stopWatching || !this.waitingByKey.get(key) || this.targetsByKey.get(key)) return;
    if (departed && router.stillRoutesTo(this.instance, departed)) return;

    const current = this.waitingByKey.valuesForKey(key).filter((token) => router.stillRoutesTo(this.instance, token));
    const [next] = current.sort((a, b) => byDocumentOrder(a.element, b.element));
    if (!next) {
      // Every waiting token is stale and normally about to be unmatched. A callback invoked later in this batch can
      // put the descriptor back first, though: the attribute then ends where it began, no record reports a change, and
      // the token stays waiting behind nobody. One more look once the batch is done finds it.
      if (departed) Promise.resolve().then(() => whileDelivering(() => this.adoptWaiting(key)));
      return;
    }

    // Every current token the element holds for the key moves with it, so a descriptor listed twice is counted the way
    // it is for any other target. A stale one stays behind for its unmatch to drop.
    for (const token of current) {
      if (token.element !== next.element) continue;
      this.waitingByKey.delete(key, token);
      this.tokensByElement.add(token.element, token);
    }
    // Reported rather than thrown: this can run while a `[key]Disconnected` that has itself thrown is unwinding, and an
    // error raised here would replace that one instead of joining it.
    invokeReporting(() => this.connect(key, next.element));
  }

  /**
   * The targets under `key`, in document order. `targetsByKey` is kept in insertion order, so the first read after a
   * change sorts; later reads get the same array until the next change, which never mutates it.
   *
   * Targets removed earlier in the same mutation batch are already detached until their unmatch is delivered, and
   * `compareDocumentPosition` orders nodes in different trees arbitrarily. A read part-way through such a batch (from a
   * `[key]Connected` or `[key]Disconnected` callback) can therefore see the survivors out of order.
   */
  private orderedTargets(key: string): T[] {
    let ordered = this.orderedByKey.get(key);
    if (!ordered) {
      ordered = this.share(key, this.targetsByKey.valuesForKey(key).sort(byDocumentOrder));
      this.orderedByKey.set(key, ordered);
    }
    return ordered;
  }

  /**
   * What the field for `key` reads while changes wait to be delivered: `now()`, worked out from the DOM, reused until
   * more changes are waiting.
   */
  private readNow(key: string, version: number, now: () => T[] | T | null): T[] | T | null {
    const cached = this.nowByKey.get(key);
    if (cached?.version === version) return cached.value;
    const value = now();
    this.nowByKey.set(key, { version, value });
    return value;
  }

  /**
   * `targets`, or the array last handed out for `key` when it holds the same elements in the same order, so a
   * `@targets()` field gives the same array until its elements change, whether it was read from the index or from the
   * DOM.
   */
  private share(key: string, targets: T[]): T[] {
    const last = this.sharedByKey.get(key);
    if (last && sameElements(last, targets)) return last;
    this.sharedByKey.set(key, targets);
    return targets;
  }

  /**
   * The elements claiming `key` as the DOM stands, in document order, this element included when it carries the key
   * itself. Once the changes waiting are delivered, they are the Targets of a `@targets()` key.
   */
  private claimants(key: string): T[] {
    const owner = this.instance as Element as T;
    // A substring match finds every candidate; `claims` then parses its tokens as the router does.
    const selector = `[data-target*="${CSS.escape(`${this.identifier}.${key}`)}"]`;
    const found: T[] = [];
    if (owner.matches(selector) && this.claims(owner, key)) found.push(owner);
    for (const element of owner.querySelectorAll<T>(selector)) {
      if (this.claims(element, key)) found.push(element);
    }
    return found;
  }

  /**
   * The element a `@target()` key will have as its Target once the changes waiting are delivered. The Target keeps the
   * key while it still claims it, and otherwise the first claimant in document order takes it: `adoptWaiting` picks
   * that one when the Target leaves, and `takesOver` hands the key to it when it is reached after another claimant.
   */
  private claimantNow(key: string): T | null {
    const [target] = this.targetsByKey.valuesForKey(key);
    if (target && this.claims(target, key)) return target;
    return this.claimants(key)[0] ?? null;
  }

  // Whether `element` lists `key` for this element's identifier, parsed as the router parses it, and this element is
  // its Owner: what `router.stillRoutesTo` checks for a token the router has delivered.
  private claims(element: Element, key: string): boolean {
    const value = element.getAttribute('data-target');
    if (!value) return false;
    const listed = value.trim().split(/\s+/).some((content) => {
      const descriptor = parseTargetDescriptor(content);
      return descriptor.identifier === this.identifier && descriptor.key === key;
    });
    return listed && element.closest(this.identifier) === (this.instance as Element);
  }

  private isStillReferenced(element: T, content: string): boolean {
    return this.tokensByElement.valuesForKey(element).some((token) => token.content === content);
  }

  private isValidIdKeyPair(identifier: string | undefined, key: string | undefined): boolean {
    if (!key || identifier !== this.identifier || !this.declarations.has(key)) {
      return false;
    }

    return true;
  }

  private invokeCallback(key: string, target: T, suffix: string) {
    const fn = (this.instance as unknown as Record<string, unknown>)[`${key}${capitalize(suffix)}`];
    if (typeof fn === 'function') {
      fn.call(this.instance, target);
    }
  }

  private isKeyMultiple(key: string): boolean {
    return this.declarations.get(key)?.multiple ?? false;
  }

  private get identifier() {
    return this.instance.identifier;
  }
}
