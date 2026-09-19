import type { TargetDeclaration } from './decorators/target';
import type { ImpulseElement } from './element';
import type { Token, TokenListWatcherDelegate } from './observers/token_list_watcher';
import SetMap from './data_structures/set_map';
import { capitalize } from './helpers/string';
import TokenRouter from './observers/token_router';
import { registeredFor, TARGETS } from './registry';
import { parseTargetDescriptor } from './target_descriptor';

// One document-wide `[data-target]` watcher for every instance; tokens are routed to the instance named by the
// `identifier.key` descriptor.
const router = new TokenRouter('data-target', (content) => parseTargetDescriptor(content).identifier);

export default class Target<T extends Element> implements TokenListWatcherDelegate<T> {
  private readonly declarations: ReadonlyMap<string, TargetDeclaration>;
  private targetsByKey: SetMap<string, T>;
  // Every matched token per element, so duplicate descriptors (`x.a x.a`) are counted and the target is only
  // unregistered once the last token referencing it goes away.
  private tokensByElement: SetMap<T, Token<T>>;
  // The `@targets()` fields' values, sorted on first read after a change and handed out until the next one.
  private orderedByKey = new Map<string, T[]>();
  private stopWatching?: () => void;

  constructor(private readonly instance: ImpulseElement) {
    this.declarations = registeredFor(this.instance, TARGETS);
    this.targetsByKey = new SetMap();
    this.tokensByElement = new SetMap();
  }

  start() {
    // Each field reads the current targets when accessed: every matching element in document order (an empty array
    // when there are none) for `@targets()`, or the element (`null` when there is none) for `@target()`.
    for (const { key, multiple } of this.declarations.values()) {
      Object.defineProperty(this.instance, key, {
        configurable: true,
        get: multiple ? () => this.orderedTargets(key) : () => this.targetsByKey.valuesForKey(key)[0] ?? null,
      });
    }

    if (!this.stopWatching) {
      this.stopWatching = router.subscribe(this.instance, this);
    }
  }

  stop() {
    const stopWatching = this.stopWatching;
    if (!stopWatching) return;
    // Reset first so a throwing stop cannot block `start()` from creating a fresh watcher on reconnect.
    this.stopWatching = undefined;
    stopWatching();
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

    // Validate before mutating `targetsByKey` so a rejected duplicate does not leave the map in an
    // inconsistent state.
    if (!this.isKeyMultiple(key) && this.targetsByKey.valuesForKey(key).length > 0) {
      throw new Error(
        `
Multiple "${key}" targets in the "${identifier}" element were defined using the @target() decorator.
Please use the @targets() decorator instead if you want to define multiple targets for the same key.
Learn more about the @targets() decorator: https://ambiki.github.io/impulse/reference/targets.html#multiple-targets
        `.trim(),
      );
    }

    this.targetsByKey.add(key, element);
    this.tokensByElement.add(element, token);
    this.orderedByKey.delete(key);
    this.invokeCallback(key, element, 'connected');
  }

  tokenUnmatched(token: Token<T>) {
    const { content, element } = token;
    const { identifier, key } = parseTargetDescriptor(content);
    if (!this.isValidIdKeyPair(identifier, key) || !this.targetsByKey.has(key, element)) return;

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
      ordered = this.targetsByKey
        .valuesForKey(key)
        .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      this.orderedByKey.set(key, ordered);
    }
    return ordered;
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
