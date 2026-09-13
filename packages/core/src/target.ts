import type { TargetType } from './decorators/target';
import type { ImpulseElement } from './element';
import type { Token, TokenListWatcherDelegate } from './observers/token_list_watcher';
import SetMap from './data_structures/set_map';
import { capitalize } from './helpers/string';
import { watchTokenList } from './observers/token_list_watcher';
import Scope from './scope';
import Store from './store';

export default class Target<T extends Element> implements TokenListWatcherDelegate<T> {
  private store: Store<TargetType>;
  private scope: Scope;
  private targetsByKey: SetMap<string, T>;
  // Every matched token per element, so duplicate descriptors (`x.a x.a`) are counted and the target is only
  // unregistered once the last token referencing it goes away.
  private tokensByElement: SetMap<T, Token<T>>;
  private stopWatching?: () => void;

  constructor(private readonly instance: ImpulseElement) {
    this.store = new Store<TargetType>(Object.getPrototypeOf(this.instance), 'target');
    this.scope = new Scope(this.instance);
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
      this.stopWatching = watchTokenList<T>(this.instance, 'data-target', this);
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
    const [identifier, key] = content.split('.');
    if (!this.isValidIdKeyPair(identifier, key)) return;
    // Check if the target is within the scope of the instance.
    if (!this.scope.scopedTarget(element)) return;

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

    const targets = this.targetsByKey
      .getValuesForKey(key)
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

    this.defineProperty(key, this.isKeyMultiple(key) ? targets : element);
    this.invokeCallback(key, element, 'connected');
  }

  tokenUnmatched(token: Token<T>) {
    const { content, element } = token;
    const [identifier, key] = content.split('.');
    if (!this.isValidIdKeyPair(identifier, key) || !this.targetsByKey.has(key, element)) return;

    this.tokensByElement.delete(element, token);
    if (this.isStillReferenced(element, content)) return;

    this.targetsByKey.delete(key, element);
    this.invokeCallback(key, element, 'disconnected');
    // Update property after invoking callback.
    this.defineProperty(key, this.isKeyMultiple(key) ? this.targetsByKey.getValuesForKey(key) : null);
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

  private get targetKeys(): Set<TargetType> {
    return this.store.value ?? new Set();
  }

  private get identifier() {
    return this.instance.identifier;
  }
}
