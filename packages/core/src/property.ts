import type { PropertyConstructor, PropertyType } from './decorators/property';
import type ImpulseElement from './element';
import { dasherize } from './helpers/string';
import Store from './store';

export default class Property {
  private store: Store;

  constructor(private readonly instance: ImpulseElement) {
    this.instance = instance;
    this.store = new Store(Object.getPrototypeOf(this.instance), 'property');
  }

  start() {
    for (const [{ key, type }] of this.properties.entries()) {
      this.initializeProperty(key, type);
    }
  }

  stop() {
    //
  }

  private initializeProperty(key: string, type: PropertyConstructor) {
    const attributeName = dasherize(key);
    const defaultValue = (this.instance as unknown as Record<string, unknown>)[key];
    const descriptor: PropertyDescriptor = {
      configurable: true,
      ...descriptorProperties(this.instance, attributeName, type),
    };

    Object.defineProperty(this.instance, key, descriptor);
    if (!this.instance.hasAttribute(attributeName)) {
      descriptor.set?.(defaultValue);
    }
  }

  private get properties() {
    return this.store.value as Set<PropertyType>;
  }
}

function descriptorProperties(element: Element, attributeName: string, type: PropertyConstructor) {
  switch (type) {
    case Number:
      return {
        get: () => Number(element.getAttribute(attributeName) || 0),
        set: (value: number) => element.setAttribute(attributeName, (value || 0).toString()),
      };
    case Boolean:
      return {
        get: () => element.hasAttribute(attributeName) && element.getAttribute(attributeName) !== 'false',
        set: (value: boolean) => {
          // Simply toggling the attribute will not work.
          if (value) {
            element.setAttribute(attributeName, '');
          } else {
            element.removeAttribute(attributeName);
          }
        },
      };
    case Array:
      return {
        get: () => JSON.parse(element.getAttribute(attributeName) || '[]'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        set: (value: any[]) => element.setAttribute(attributeName, JSON.stringify(value) || '[]'),
      };
    case Object:
      return {
        get: () => JSON.parse(element.getAttribute(attributeName) || '{}'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        set: (value: Record<any, any>) => element.setAttribute(attributeName, JSON.stringify(value) || '{}'),
      };
    default:
      return {
        get: () => element.getAttribute(attributeName) || '',
        set: (value: string) => element.setAttribute(attributeName, value || ''),
      };
  }
}
