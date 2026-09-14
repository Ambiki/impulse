import type { TargetType } from './decorators/target';
import type { ImpulseElement } from './element';
import type { Token, TokenListWatcherDelegate } from './observers/token_list_watcher';
import SetMap from './data_structures/set_map';
import { capitalize } from './helpers/string';
import TokenRouter from './observers/token_router';
import { registeredFor, TARGETS } from './store';
import { parseTargetDescriptor } from './target_descriptor';

// One document-wide `[data-target]` watcher for every instance; tokens are routed to the instance named by the
// `identifier.key` descriptor.
const router = new TokenRouter('data-target', (content) => parseTargetDescriptor(content).identifier);

export default class Target<T extends Element> implements TokenListWatcherDelegate<T> {
  private targetsByKey: SetMap<string, T>;
  // Every matched token per element, so duplicate descriptors (`x.a x.a`) are counted and the target is only
  // unregistered once the last token referencing it goes away.
  private tokensByElement: SetMap<T, Token<T>>;
  private stopWatching?: () => void;

  constructor(private readonly instance: ImpulseElement) {
    this.targetsByKey = new SetMap();
    this.tokensByElement = new SetMap();
  }

  start() {
    // Initialize targets with an empty array if it references multiple targets, or with null if it references a single
    // target. Later, if we find matching targets, we set them accordingly. If we don't, we can still iterate over
    // targets because it is an array.
    for (const key of this.keys) {
      this.defineProperty(key, this.isKeyMultiple(key) ? [] : null);
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
    if (!this.isKeyMultiple(key) && this.targetsByKey.getValuesForKey(key).length > 0) {
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

    this.defineProperty(key, this.isKeyMultiple(key) ? this.targetsInDocumentOrder(key) : element);
    this.invokeCallback(key, element, 'connected');
  }

  tokenUnmatched(token: Token<T>) {
    const { content, element } = token;
    const { identifier, key } = parseTargetDescriptor(content);
    if (!this.isValidIdKeyPair(identifier, key) || !this.targetsByKey.has(key, element)) return;

    this.tokensByElement.delete(element, token);
    if (this.isStillReferenced(element, content)) return;

    this.targetsByKey.delete(key, element);
    this.invokeCallback(key, element, 'disconnected');
    // Update property after invoking callback.
    this.defineProperty(key, this.isKeyMultiple(key) ? this.targetsInDocumentOrder(key) : null);
  }

  /**
   * The targets under `key`, in document order.
   *
   * Both the connect and the disconnect path sort through here, because `targetsByKey` itself is never ordered: the
   * connect path sorts a throwaway array, so one target connecting out of document order leaves the underlying set
   * unsorted for good, and an unsorted disconnect path then hands that order straight to the property.
   *
   * Targets removed earlier in the same mutation batch are already detached when this runs, and
   * `compareDocumentPosition` orders nodes in different trees arbitrarily. A `[key]Disconnected` callback part-way
   * through such a batch can therefore see the survivors out of order; the last unmatch of the batch sorts them
   * correctly again.
   */
  private targetsInDocumentOrder(key: string): T[] {
    return this.targetsByKey
      .getValuesForKey(key)
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  }

  private isStillReferenced(element: T, content: string): boolean {
    return this.tokensByElement.getValuesForKey(element).some((token) => token.content === content);
  }

  private defineProperty(key: string, result: T | T[] | null) {
    Object.defineProperty(this.instance, key, { configurable: true, get: () => result });
  }

  private isValidIdKeyPair(identifier: string | undefined, key: string | undefined): boolean {
    if (!key || identifier !== this.identifier || !this.keys.includes(key)) {
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
    for (const targetKey of this.targetKeys) {
      if (targetKey.key === key) {
        return targetKey.multiple;
      }
    }

    return false;
  }

  private get keys() {
    return Array.from(this.targetKeys).map(({ key }) => key);
  }

  private get targetKeys(): ReadonlySet<TargetType> {
    return registeredFor(this.instance, TARGETS);
  }

  private get identifier() {
    return this.instance.identifier;
  }
}
