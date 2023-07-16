import type ImpulseElement from './element';
import { dasherize } from './helpers/string';
import { PropertyConstructor } from './decorators/property';

export default class Property {
  constructor(private instance: ImpulseElement) {
    this.instance = instance;
  }

  start() {
    for (const [key, { type }] of this.values.entries()) {
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

  private get values() {
    return (Object.getPrototypeOf(this.instance).constructor as typeof ImpulseElement).properties;
  }
}

function descriptorProperties(element: HTMLElement, attributeName: string, type: PropertyConstructor) {
  if (type === Number) {
    return {
      get: () => Number(element.getAttribute(attributeName) || 0),
      set: (value?: number) => {
        if (typeof value === 'number') {
          element.setAttribute(attributeName, value.toString());
        } else {
          element.removeAttribute(attributeName);
        }
      },
    };
  }

  if (type === Boolean) {
    return {
      get: () => element.hasAttribute(attributeName) && element.getAttribute(attributeName) !== 'false',
      set: (value?: boolean) => element.toggleAttribute(attributeName, !!value),
    };
  }

  return {
    get: () => element.getAttribute(attributeName) || '',
    set: (value?: string) => {
      if (value) {
        element.setAttribute(attributeName, value);
      } else {
        element.removeAttribute(attributeName);
      }
    },
  };
}
