import type { PropertyConstructor, PropertyType } from './decorators/property';
import type { ImpulseElement } from './element';
import { dasherize } from './helpers/string';
import Store from './store';

export default class Property {
  private store: Store<PropertyType>;

  constructor(private readonly instance: ImpulseElement) {
    this.store = new Store<PropertyType>(Object.getPrototypeOf(this.instance), 'property');
  }

  start() {
    for (const [{ key, type }] of this.properties.entries()) {
      this.initializeProperty(key, type);
    }
  }

  stop() {
    // No-op: the defined getters/setters delegate to the element's attributes, so there is no
    // per-instance state to tear down when the element disconnects.
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

  private get properties(): Set<PropertyType> {
    return this.store.value ?? new Set();
  }
}

function descriptorProperties(element: Element, attributeName: string, type: PropertyConstructor) {
  switch (type) {
    case Number:
      return {
        get: () => Number(element.getAttribute(attributeName)?.replace(/_/g, '') || 0),
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
        get: () => parseAttributeJSON(element, attributeName, []),
        set: (value: any[]) => element.setAttribute(attributeName, JSON.stringify(value) || '[]'),
      };
    case Object:
      return {
        get: () => parseAttributeJSON(element, attributeName, {}),
        set: (value: Record<any, any>) => element.setAttribute(attributeName, JSON.stringify(value) || '{}'),
      };
    default:
      return {
        get: () => element.getAttribute(attributeName) || '',
        set: (value: string) => element.setAttribute(attributeName, value || ''),
      };
  }
}

/**
 * Reads a JSON-typed (`Array`/`Object`) property attribute. When the attribute holds malformed JSON we log a descriptive
 * error and return `fallback` rather than throwing - a getter that throws would break unrelated code that merely reads
 * the property - while still making the mistake visible to the developer.
 */
function parseAttributeJSON<T>(element: Element, attributeName: string, fallback: T): T {
  const value = element.getAttribute(attributeName);
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch {
    console.error(
      `<${element.localName}> has malformed JSON in its "${attributeName}" attribute: ${JSON.stringify(value)}. ` +
      `Falling back to ${JSON.stringify(fallback)}.`,
    );
    return fallback;
  }
}
