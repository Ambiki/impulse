import type { TargetDeclaration } from './decorators/target';
import type { ImpulseElement } from './element';
import type { Token, TokenListWatcherDelegate } from './observers/token_list_watcher';
import SetMap from './data_structures/set_map';
import { invokeReporting, reportUncaught } from './helpers/errors';
import { capitalize } from './helpers/string';
import { currentDelivery, undeliveredVersion, whileDelivering } from './observers/document_observer';
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
  // The array each `@targets()` field last handed out (see `stableArray`).
  private stableByKey = new Map<string, T[]>();
  // The delivery since which each `@target()` key's Target has held it, a move counting as holding on (see
  // `takesOver`).
  private heldSinceByKey = new Map<string, number>();
  // The Target each `@target()` key last lost, when it had held it since, and the delivery it left in (see
  // `keptForMovedTarget`).
  private departedByKey = new Map<string, { element: T; since: number; delivery: number }>();
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
        {
          delivered: () => this.stableArray(key, this.orderedTargets(key)),
          now: () => this.stableArray(key, this.claimants(key)),
        } :
        { delivered: () => this.targetsByKey.valuesForKey(key)[0] ?? null, now: () => this.claimantNow(key) };
      Object.defineProperty(this.instance, key, {
        configurable: true,
        get: () => {
          if (!this.stopWatching) {
            // Not subscribed: initializing (its tokens being replayed), or torn down, either removed or moved and not
            // yet initialized again. A moved element still has its targets in the DOM though the index has none, so
            // it reads them there. While its tokens are replayed or torn down, it reads what has been delivered.
            return currentDelivery() === 0 && this.isInDocumentTree() ? read.now() : read.delivered();
          }
          const version = undeliveredVersion();
          if (version && this.isInDocumentTree()) return this.readNow(key, version, read.now);
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
      this.stableByKey.clear();
      this.heldSinceByKey.clear();
      this.departedByKey.clear();
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
    if (!this.isKeyMultiple(key)) {
      const [target] = this.targetsByKey.valuesForKey(key);
      if (target && this.takesOver(key, target, element)) {
        this.handOver(key, target, token);
        return;
      }
      if (target || this.keptForMovedTarget(key, element)) {
        this.waitingByKey.add(key, token);
        this.reportIfLeftWaiting(key, token);
        // Should the moved Target not come back after all, the key is not left empty with a claimant waiting.
        if (!target) Promise.resolve().then(() => whileDelivering(() => this.adoptWaiting(key)));
        return;
      }
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
      if (!this.isKeyMultiple(key)) {
        const since = this.heldSinceByKey.get(key) ?? currentDelivery();
        this.departedByKey.set(key, { element, since, delivery: currentDelivery() });
      }
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
    if (!this.isKeyMultiple(key)) {
      // A Target that left earlier in this delivery and is back was moved: it has held the key all along.
      const departed = this.departedByKey.get(key);
      const moved = departed?.element === element && departed.delivery === currentDelivery();
      this.heldSinceByKey.set(key, moved ? departed.since : currentDelivery());
    }
    this.invokeCallback(key, element, 'connected');
  }

  /**
   * Whether `claimant` takes a `@target()` key from its Target, `target`. A read made before this delivery took the
   * key's Target from then while it still claimed the key, and otherwise the first claimant in document order
   * (`claimantNow`). So a Target that only got the key in this delivery gives way to a claimant ahead of it, and one
   * that held it before keeps it, the claimant waiting behind it.
   */
  private takesOver(key: string, target: T, claimant: T): boolean {
    return (
      this.heldSinceByKey.get(key) === currentDelivery() &&
      byDocumentOrder(claimant, target) < 0 &&
      this.claims(claimant, key) &&
      this.claims(target, key)
    );
  }

  /**
   * Makes the element of `token` the Target of a `@target()` key in place of `target`, which waits behind it as a
   * second claimant does: `[key]Disconnected` for `target`, then `[key]Connected` for the new one.
   *
   * `target`'s tokens are already waiting when its callback runs, so a teardown the callback causes finds nothing of it
   * left to disconnect, and after a teardown nothing is connected.
   */
  private handOver(key: string, target: T, token: Token<T>) {
    const displaced = this.tokensByElement
      .valuesForKey(target)
      .filter((held) => parseTargetDescriptor(held.content).key === key);
    for (const held of displaced) {
      this.tokensByElement.delete(target, held);
      this.waitingByKey.add(key, held);
    }
    try {
      this.invokeCallback(key, target, 'disconnected');
    } finally {
      this.targetsByKey.delete(key, target);
      if (this.stopWatching) {
        if (displaced[0]) this.reportIfLeftWaiting(key, displaced[0]);
        this.tokensByElement.add(token.element, token);
        // Reported rather than thrown, as in `adoptWaiting`: it can run while a throwing `[key]Disconnected` unwinds.
        invokeReporting(() => this.connect(key, token.element));
      }
    }
  }

  /**
   * Whether a `@target()` key with no Target is kept for the one it had before this delivery. That Target left the key
   * earlier in the delivery but still claims it in the DOM, so it was moved and its token is about to be matched
   * again. A read made before the delivery said it keeps the key (`claimantNow`), so `element` waits.
   */
  private keptForMovedTarget(key: string, element: T): boolean {
    const departed = this.departedByKey.get(key);
    return (
      departed !== undefined &&
      departed.element !== element &&
      departed.delivery === currentDelivery() &&
      departed.since !== departed.delivery &&
      this.claims(departed.element, key)
    );
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
      ordered = this.targetsByKey.valuesForKey(key).sort(byDocumentOrder);
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
  private stableArray(key: string, targets: T[]): T[] {
    const last = this.stableByKey.get(key);
    if (last === targets || (last && sameElements(last, targets))) return last;
    this.stableByKey.set(key, targets);
    return targets;
  }

  // The index never sees an element inside a shadow root, which a document observer does not reach, so neither may a
  // read that works the field out from the DOM.
  private isInDocumentTree(): boolean {
    return this.instance.getRootNode() === document;
  }

  /**
   * The elements claiming `key` as the DOM stands, in document order, this element included when it carries the key
   * itself. Once the changes waiting are delivered, they are the Targets of a `@targets()` key.
   */
  private claimants(key: string): T[] {
    const owner = this.instance as Element as T;
    // A substring match finds every candidate; `claims` then asks the router about each.
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

  // Whether the router would route a token on `element` naming `key` to this element, as the DOM stands.
  private claims(element: Element, key: string): boolean {
    return router.routesTo(this.instance, element, (content) => {
      const descriptor = parseTargetDescriptor(content);
      return descriptor.identifier === this.identifier && descriptor.key === key;
    });
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
