import SetMap from './data_structures/set_map';
import type ImpulseElement from './element';
import { getAttributeValues } from './helpers/dom';
import AttributeObserver from './observers/attribute_observer';
import Scope from './scope';
import Store from './store';

export default class Targets {
  private store: Store;
  private scope: Scope;
  private targetsByName: SetMap<string, Element>;
  private attributeObserver: AttributeObserver;

  constructor(private readonly instance: ImpulseElement) {
    this.instance = instance;
    this.store = new Store(Object.getPrototypeOf(this.instance), 'targets');
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
        this.findTargets(key).includes(target)
      ) {
        this.targetsByName.add(key, target);
        this.defineProperty(key, this.findTargets(key));
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
        this.defineProperty(key, this.findTargets(key));
      }
    }
  }

  private initializeKey(key: string) {
    const targets = this.findTargets(key);
    targets.forEach((target) => this.targetsByName.add(key, target));
    this.defineProperty(key, targets);
    targets.forEach((target) => this.invokeConnectedCallback(key, target));
  }

  private terminateKey(key: string) {
    const targets = this.findTargets(key);
    targets.forEach((target) => this.invokeDisconnectedCallback(key, target));
  }

  private findTargets(key: string) {
    return this.scope.findTargets(`[data-target~="${this.identifier}.${key}"]`);
  }

  private defineProperty(key: string, targets: Element[]) {
    const descriptor: PropertyDescriptor = { configurable: true, get: () => targets };
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
