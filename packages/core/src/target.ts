import SetMap from './data_structures/set_map';
import type { TargetType } from './decorators/target';
import type ImpulseElement from './element';
import { capitalize } from './helpers/string';
import TokenListObserver, { Token } from './observers/token_list_observer';
import Scope from './scope';
import Store from './store';

export default class Target {
  private store: Store;
  private scope: Scope;
  private targetsByKey: SetMap<string, Element>;
  private tokenListObserver?: TokenListObserver;

  constructor(private readonly instance: ImpulseElement) {
    this.instance = instance;
    this.store = new Store(Object.getPrototypeOf(this.instance), 'target');
    this.scope = new Scope(this.instance);
    this.targetsByKey = new SetMap();
  }

  start() {
    if (!this.tokenListObserver) {
      this.tokenListObserver = new TokenListObserver(this.instance, 'data-target', this);
      this.tokenListObserver.start();
      this.initializeTargets();
    }
  }

  stop() {
    if (this.tokenListObserver) {
      this.destroyTargets();
      this.tokenListObserver.stop();
      this.tokenListObserver = undefined;
    }
  }

  tokenMatched({ content, element }: Token) {
    const [identifier, key] = content.split('.');
    if (!this.isValidIdKeyPair(identifier, key) || this.targetsByKey.has(key, element)) return;
    // Check if the target is within the scope of the instance.
    if (!this.scope.scopedTarget(element)) return;

    this.targetsByKey.add(key, element);

    const targets = this.targetsByKey.getValuesForKey(key);
    if (targets.length > 1 && !this.isKeyMultiple(key)) {
      throw new Error(
        `
Multiple "${key}" targets in the "${identifier}" element were defined using the @target() decorator.
Please use the @targets() decorator instead if you want to define multiple targets for the same key.
Learn more about the @targets() decorator: https://ambiki.github.io/impulse/reference/targets.html#multiple-targets
        `
      );
    }

    this.defineProperty(key, this.isKeyMultiple(key) ? this.targetsByKey.getValuesForKey(key) : element);
    this.invokeCallback(key, element, 'connected');
  }

  tokenUnmatched({ content, element }: Token) {
    const [identifier, key] = content.split('.');
    if (!this.isValidIdKeyPair(identifier, key) || !this.targetsByKey.has(key, element)) return;

    this.targetsByKey.delete(key, element);
    this.invokeCallback(key, element, 'disconnected');
    // Update property after invoking callback.
    this.defineProperty(key, this.isKeyMultiple(key) ? this.targetsByKey.getValuesForKey(key) : null);
  }

  private initializeTargets() {
    for (const key of this.keys) {
      const targets = this.scope.findTargets(`[data-target~="${this.identifier}.${key}"]`);
      // If no targets were found, define the property as null or an empty array.
      if (!targets.length) {
        this.defineProperty(key, this.isKeyMultiple(key) ? [] : null);
      }

      targets.forEach((target) => this.tokenListObserver?.elementConnected(target));
    }
  }

  private destroyTargets() {
    for (const name of this.targetsByKey.keys) {
      const targets = this.targetsByKey.getValuesForKey(name);
      targets.forEach((target) => this.tokenListObserver?.elementDisconnected(target));
    }
  }

  private defineProperty(key: string, result: Element | Element[] | null) {
    Object.defineProperty(this.instance, key, { configurable: true, get: () => result });
  }

  private isValidIdKeyPair(identifier: string | undefined, key: string | undefined): boolean {
    if (!key || identifier !== this.identifier || !this.keys.includes(key)) {
      return false;
    }

    return true;
  }

  private invokeCallback(key: string, target: Element, suffix: string) {
    const fn = (this.instance as unknown as Record<string, unknown>)[`${key}${capitalize(suffix)}`];
    if (typeof fn === 'function') {
      fn.call(this.instance, target);
    }
  }

  private isKeyMultiple(key: string): boolean {
    return Array.from(this.targetKeys).find((t) => t.key === key)?.multiple ?? false;
  }

  private get keys() {
    return Array.from(this.targetKeys).map(({ key }) => key);
  }

  private get targetKeys() {
    return this.store.value as Set<TargetType>;
  }

  private get identifier() {
    return this.instance.identifier;
  }
}
