import type ImpulseElement from './element';
import { getAttributeValues } from './helpers/dom';
import AttributeObserver from './observers/attribute_observer';

const ATTRIBUTE_NAME = 'data-target';

export default class Targets {
  private attributeObserver: AttributeObserver;

  constructor(private readonly instance: ImpulseElement) {
    this.instance = instance;
    this.attributeObserver = new AttributeObserver(this.instance, ATTRIBUTE_NAME, this);
  }

  start() {
    this.attributeObserver.start();
    for (const [key] of this.targetKeys.entries()) {
      this.initializeKey(key);
    }
  }

  stop() {
    for (const [key] of this.targetKeys.entries()) {
      this.terminateKey(key);
    }
    this.attributeObserver.stop();
  }

  elementConnected(element: Element) {
    const values = getAttributeValues(element, ATTRIBUTE_NAME);
    values.forEach((value) => {
      const [elementName, key] = value.split('.');
      if (!elementName || !key || elementName !== this.identifier) return;
      // Element needs to be registered before we can process its addition.
      if (!this.targetKeys.has(key)) return;
      // In the callback function, we should be able to call `this.elements` and get back all the elements. Therefore,
      // we need to set the property before calling the function.
      this.defineProperty(key, this.findTargets(key));
      this.processAddedElement(key, element);
    });
  }

  elementDisconnected(element: Element) {
    const values = getAttributeValues(element, ATTRIBUTE_NAME);
    values.forEach((value) => {
      const [elementName, key] = value.split('.');
      if (!elementName || !key || elementName !== this.identifier) return;
      // Element needs to be registered before we can process its removal.
      if (!this.targetKeys.has(key)) return;
      this.processRemovedElement(key, element);
      // In the callback function, we should be able to call `this.elements` and get back all the elements. Therefore,
      // we need to set the property after calling the function. If you need an updated list of elements within this
      // function, consider running the code after `await new Promise((resolve) => requestAnimationFrame(resolve))`.
      this.defineProperty(key, this.findTargets(key));
    });
  }

  private initializeKey(key: string) {
    // If the key has not been registered, return.
    if (!this.targetKeys.has(key)) return;

    const targets = this.findTargets(key);
    this.defineProperty(key, targets);
    targets.forEach((target) => this.processAddedElement(key, target));
  }

  private terminateKey(key: string) {
    // If the key has not been registered, return.
    if (!this.targetKeys.has(key)) return;

    const targets = this.findTargets(key);
    targets.forEach((target) => this.processRemovedElement(key, target));
    this.defineProperty(key, targets);
  }

  private defineProperty(key: string, value: Element[]) {
    const descriptor: PropertyDescriptor = { configurable: true, get: () => value };
    Object.defineProperty(this.instance, key, descriptor);
  }

  private processAddedElement(key: string, element: Element) {
    const fn = (this.instance as unknown as Record<string, unknown>)[`${key}Connected`];
    if (typeof fn === 'function') {
      fn.call(this.instance, element);
    }
  }

  private processRemovedElement(key: string, element: Element) {
    const fn = (this.instance as unknown as Record<string, unknown>)[`${key}Disconnected`];
    if (typeof fn === 'function') {
      fn.call(this.instance, element);
    }
  }

  private findTargets(key: string) {
    const selector = `[${ATTRIBUTE_NAME}~="${this.identifier}.${key}"]`;
    return Array.from(this.instance.querySelectorAll(selector));
  }

  private get targetKeys() {
    return (Object.getPrototypeOf(this.instance).constructor as typeof ImpulseElement).targetsKeys;
  }

  private get identifier() {
    return this.instance.identifier;
  }
}
