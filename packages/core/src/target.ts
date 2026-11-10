import type { TargetDeclaration } from './decorators/target';
import type { ImpulseElement } from './element';
import type { Token, TokenListWatcherDelegate } from './observers/token_list_watcher';
import type { SingleTarget, SingleTargetHost } from './single_target';
import SetMap from './data_structures/set_map';
import { byDocumentOrder } from './helpers/dom';
import { reportUncaught } from './helpers/errors';
import { capitalize } from './helpers/string';
import { currentDelivery, undeliveredVersion, whileDelivering } from './observers/document_observer';
import TokenRouter from './observers/token_router';
import { registeredFor, TARGETS } from './registry';
import { createSingleTarget } from './single_target';
import { parseTargetDescriptor } from './target_descriptor';

// One document-wide `[data-target]` watcher for every instance; tokens are routed to the instance named by the
// `identifier.key` descriptor.
const router = new TokenRouter('data-target', (content) => parseTargetDescriptor(content).identifier);

function sameElements(a: readonly Element[], b: readonly Element[]): boolean {
  return a.length === b.length && a.every((element, index) => element === b[index]);
}

export default class Target<T extends Element> implements TokenListWatcherDelegate<T>, SingleTargetHost<T> {
  private readonly declarations: ReadonlyMap<string, TargetDeclaration>;
  // The `@targets()` fields' Targets, in the order they connected.
  private targetsByKey: SetMap<string, T>;
  // Every matched token per element, so duplicate descriptors (`x.a x.a`) are counted: a `@targets()` Target is only
  // unregistered once the last token with its spelling goes away, and a `@target()` Claimant only released once the
  // last token naming the key does.
  private tokensByElement: SetMap<T, Token<T>>;
  // The rule each `@target()` field follows, deciding which of its Claimants is the Target.
  private readonly singles = new Map<string, SingleTarget<T>>();
  // The `@targets()` fields' values, sorted on first read after a change and handed out until the next one.
  private orderedByKey = new Map<string, T[]>();
  // What each field read while DOM changes waited to be delivered, worked out from the DOM, with the
  // `undeliveredVersion()` it holds for. Reused until more changes are waiting.
  private nowByKey = new Map<string, { version: number; value: T[] | T | null }>();
  // The array each `@targets()` field last handed out (see `stableArray`).
  private stableByKey = new Map<string, T[]>();
  private stopWatching?: () => void;
  // Whether the element is subscribed, from the moment it starts subscribing until its teardown begins. Unlike
  // `stopWatching`, which is only set once `subscribe` returns, it holds while the tokens already on the page are
  // replayed, so a takeover or an adoption made then connects the element it should.
  private subscribed = false;

  constructor(private readonly instance: ImpulseElement) {
    this.declarations = registeredFor(this.instance, TARGETS);
    this.targetsByKey = new SetMap();
    this.tokensByElement = new SetMap();
    for (const { key, multiple } of this.declarations.values()) {
      if (!multiple) this.singles.set(key, createSingleTarget(this, key));
    }
  }

  start() {
    // Each field reads its Targets when accessed: all of them in document order (an empty array when there are none)
    // for `@targets()`, or the one (`null` when there is none) for `@target()`. While DOM changes wait to be delivered,
    // the index is behind, so the field is worked out from the DOM instead, and the callbacks still run when the
    // changes are delivered (docs/adr/0006).
    for (const { key } of this.declarations.values()) {
      const single = this.singles.get(key);
      const read = single ?
        { delivered: () => single.target, now: () => single.now() } :
        {
          delivered: () => this.stableArray(key, this.orderedTargets(key)),
          now: () => this.stableArray(key, this.claimants(key)),
        };
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
      this.subscribed = true;
      try {
        this.stopWatching = router.subscribe(this.instance, this);
      } catch (error) {
        this.subscribed = false;
        throw error;
      }
    }
  }

  stop() {
    const stopWatching = this.stopWatching;
    if (!stopWatching) return;
    // Reset first so a throwing stop cannot block `start()` from creating a fresh watcher on reconnect, and so the
    // `@target()` fields can tell the releases that follow are a teardown (`active`).
    this.stopWatching = undefined;
    this.subscribed = false;
    this.nowByKey.clear();
    try {
      stopWatching();
    } finally {
      // Dropped once the teardown's callbacks have read their last, so removed elements are not kept alive.
      this.stableByKey.clear();
      for (const single of this.singles.values()) single.reset();
    }
  }

  tokenMatched(token: Token<T>) {
    const { content, element } = token;
    const { identifier, key } = parseTargetDescriptor(content);
    // The router only delivers tokens whose closest `identifier` ancestor is this instance, so no scope check is
    // needed here. `isValidIdKeyPair` still rejects tokens routed here by a selector other than this tag name.
    if (!this.isValidIdKeyPair(identifier, key)) return;

    // A `@target()` field's rule hears about an element when it starts claiming the field, not about each token.
    const single = this.singles.get(key);
    if (single) {
      const claimed = this.holdsKey(element, key);
      this.tokensByElement.add(element, token);
      if (!claimed) single.claim(element);
      return;
    }

    if (this.targetsByKey.has(key, element)) {
      this.tokensByElement.add(element, token);
      return;
    }

    this.tokensByElement.add(element, token);
    this.connect(key, element);
  }

  tokenUnmatched(token: Token<T>) {
    const { content, element } = token;
    const { identifier, key } = parseTargetDescriptor(content);
    if (!this.isValidIdKeyPair(identifier, key)) return;

    const single = this.singles.get(key);
    if (single) {
      if (this.tokensByElement.delete(element, token) && !this.holdsKey(element, key)) single.release(element);
      return;
    }

    if (!this.targetsByKey.has(key, element)) return;

    this.tokensByElement.delete(element, token);
    if (this.isStillReferenced(element, content)) return;

    // The callback still sees the target in the field; it is forgotten afterwards, even if the callback throws.
    try {
      this.invokeCallback(key, element, 'disconnected');
    } finally {
      this.targetsByKey.delete(key, element);
      this.orderedByKey.delete(key);
    }
  }

  private connect(key: string, element: T) {
    this.targetsByKey.add(key, element);
    this.orderedByKey.delete(key);
    this.invokeCallback(key, element, 'connected');
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
  claimants(key: string): T[] {
    const owner = this.instance as Element as T;
    // A substring match finds every element that may claim the key; `claims` then asks the router about each.
    const selector = `[data-target*="${CSS.escape(`${this.identifier}.${key}`)}"]`;
    const found: T[] = [];
    if (owner.matches(selector) && this.claims(key, owner)) found.push(owner);
    for (const element of owner.querySelectorAll<T>(selector)) {
      if (this.claims(key, element)) found.push(element);
    }
    return found;
  }

  // Whether the router would route a token on `element` naming `key` to this element, as the DOM stands.
  claims(key: string, element: Element): boolean {
    return router.routesTo(this.instance, element, (content) => {
      const descriptor = parseTargetDescriptor(content);
      return descriptor.identifier === this.identifier && descriptor.key === key;
    });
  }

  connected(key: string, element: T) {
    this.invokeCallback(key, element, 'connected');
  }

  disconnected(key: string, element: T) {
    this.invokeCallback(key, element, 'disconnected');
  }

  reportMultiple(key: string) {
    reportUncaught(
      new Error(
        `
Multiple "${key}" targets in the "${this.identifier}" element were defined using the @target() decorator.
Please use the @targets() decorator instead if you want to define multiple targets for the same key.
Learn more about the @targets() decorator: https://ambiki.github.io/impulse/reference/targets.html#multiple-targets
        `.trim(),
      ),
    );
  }

  active(): boolean {
    return this.subscribed;
  }

  clock(): number {
    return currentDelivery();
  }

  // Tokens arrive in synchronous runs: a mutation batch, or the replay when the instance starts. A microtask queued
  // from inside a run is therefore invoked once every token in it has been delivered.
  afterRun(task: () => void) {
    Promise.resolve().then(task);
  }

  deliver(task: () => void) {
    whileDelivering(task);
  }

  private isStillReferenced(element: T, content: string): boolean {
    return this.tokensByElement.valuesForKey(element).some((token) => token.content === content);
  }

  // Whether `element` has a delivered token naming `key`.
  private holdsKey(element: T, key: string): boolean {
    return this.tokensByElement.valuesForKey(element).some((token) => parseTargetDescriptor(token.content).key === key);
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

  private get identifier() {
    return this.instance.identifier;
  }
}
