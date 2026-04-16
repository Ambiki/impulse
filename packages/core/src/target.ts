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
  private stopWatching?: () => void;

  constructor(private readonly instance: ImpulseElement) {
    this.store = new Store<TargetType>(Object.getPrototypeOf(this.instance), 'target');
    this.scope = new Scope(this.instance);
    this.targetsByKey = new SetMap();
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
    if (this.stopWatching) {
      this.stopWatching();
      this.stopWatching = undefined;
    }
  }

  tokenMatched({ content, element }: Token<T>) {
    const [identifier, key] = content.split('.');
    if (!this.isValidIdKeyPair(identifier, key) || this.targetsByKey.has(key, element)) return;
    // Check if the target is within the scope of the instance.
    if (!this.scope.scopedTarget(element)) return;

    this.targetsByKey.add(key, element);

    const targets = this.targetsByKey
      .getValuesForKey(key)
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    if (targets.length > 1 && !this.isKeyMultiple(key)) {
      throw new Error(
        `
Multiple "${key}" targets in the "${identifier}" element were defined using the @target() decorator.
Please use the @targets() decorator instead if you want to define multiple targets for the same key.
Learn more about the @targets() decorator: https://ambiki.github.io/impulse/reference/targets.html#multiple-targets
        `.trim(),
      );
    }

    this.defineProperty(key, this.isKeyMultiple(key) ? targets : element);
    this.invokeCallback(key, element, 'connected');
  }

  tokenUnmatched({ content, element }: Token<T>) {
    const [identifier, key] = content.split('.');
    if (!this.isValidIdKeyPair(identifier, key) || !this.targetsByKey.has(key, element)) return;

    this.targetsByKey.delete(key, element);
    this.invokeCallback(key, element, 'disconnected');
    // Update property after invoking callback.
    this.defineProperty(key, this.isKeyMultiple(key) ? this.targetsByKey.getValuesForKey(key) : null);
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
