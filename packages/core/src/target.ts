import SetMap from './data_structures/set_map';
import type ImpulseElement from './element';
import { getAttributeValues } from './helpers/dom';
import AttributeObserver from './observers/attribute_observer';
import Scope from './scope';
import Store from './store';

export default class Target {
  private store: Store;
  private scope: Scope;
  private targetsByName: SetMap<string, Element>;
  private attributeObserver: AttributeObserver;

  constructor(private readonly instance: ImpulseElement) {
    this.instance = instance;
    this.store = new Store(Object.getPrototypeOf(this.instance), 'target');
    this.scope = new Scope(this.instance);
    this.targetsByName = new SetMap();
    this.attributeObserver = new AttributeObserver(this.instance, 'data-target', this);
  }

  start() {
    this.attributeObserver.start();
    this.keys.forEach((key) => this.initializeKey(key));
  }

  stop() {
    this.keys.forEach((key) => this.terminateKey(key));
    this.attributeObserver.stop();
  }

  elementConnected(target: Element) {
    const tokens = getAttributeValues(target, 'data-target');
    for (const token of tokens) {
      const [identifier, key] = token.split('.');
      if (
        key &&
        !this.targetsByName.has(key, target) &&
        identifier === this.identifier &&
        this.keys.includes(key) &&
        this.findTarget(key) === target
      ) {
        this.targetsByName.add(key, target);
        this.defineProperty(key, this.findTarget(key));
        this.invokeConnectedCallback(key, target);
      }
    }
  }

  elementDisconnected(target: Element) {
    const tokens = getAttributeValues(target, 'data-target');
    for (const token of tokens) {
      const [identifier, key] = token.split('.');
      if (key && this.targetsByName.has(key, target) && identifier === this.identifier && this.keys.includes(key)) {
        this.invokeDisconnectedCallback(key, target);
        this.defineProperty(key, null);
      }
    }
  }

  private initializeKey(key: string) {
    const target = this.findTarget(key);
    if (target) {
      this.targetsByName.add(key, target);
    }

    this.defineProperty(key, target);

    if (target) {
      this.invokeConnectedCallback(key, target);
    }
  }

  private terminateKey(key: string) {
    const target = this.findTarget(key);
    if (target) {
      this.invokeDisconnectedCallback(key, target);
    }
  }

  private findTarget(key: string) {
    return this.scope.findTarget(`[data-target~="${this.identifier}.${key}"]`);
  }

  private defineProperty(key: string, target: Element | null) {
    const descriptor: PropertyDescriptor = { configurable: true, get: () => target };
    Object.defineProperty(this.instance, key, descriptor);
  }

  private invokeConnectedCallback(key: string, target: Element) {
    const fn = (this.instance as unknown as Record<string, unknown>)[`${key}Connected`];
    if (typeof fn === 'function') {
      fn.call(this.instance, target);
    }
  }

  private invokeDisconnectedCallback(key: string, target: Element) {
    const fn = (this.instance as unknown as Record<string, unknown>)[`${key}Disconnected`];
    if (typeof fn === 'function') {
      fn.call(this.instance, target);
    }
  }

  private get keys() {
    return Array.from(this.store.value as Set<{ key: string }>).map(({ key }) => key);
  }

  private get identifier() {
    return this.instance.identifier;
  }
}
