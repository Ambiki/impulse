import type { PropertyConstructor, PropertyType } from './decorators/property';
import type { ImpulseElement } from './element';
import { dasherize, parseJSON } from './helpers/string';
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

/**
 * Converts an attribute value into the value of its `@property()` for the given type.
 *
 * Both the property getter and `attributeChangedCallback` read through this, so `this.prop` and the value handed to
 * `[property]Changed` can never disagree. A missing attribute (`null`) yields the same empty value the getter
 * reports: `0` for a Number rather than `NaN`, `''` for a String rather than `null`.
 *
 * @example
 * fromAttribute('8_000', Number);
 * //=> 8000
 *
 * fromAttribute(null, String);
 * //=> ''
 */
export function fromAttribute(value: string | null, type: PropertyConstructor) {
  switch (type) {
    case Number:
      return Number(value?.replace(/_/g, '') || 0);
    case Boolean:
      return value !== null && value !== 'false';
    case Array:
      return parseJSON(value, []);
    case Object:
      return parseJSON(value, {});
    default:
      return value || '';
  }
}

function descriptorProperties(element: Element, attributeName: string, type: PropertyConstructor) {
  return {
    get: () => fromAttribute(element.getAttribute(attributeName), type),
    set: toAttribute(element, attributeName, type),
  };
}

/**
 * Returns the setter that writes a property value back to its attribute. Kept beside `fromAttribute` so the two
 * halves of the conversion stay in step, case for case.
 */
function toAttribute(element: Element, attributeName: string, type: PropertyConstructor) {
  switch (type) {
    case Number:
      return (value: number) => element.setAttribute(attributeName, (value || 0).toString());
    case Boolean:
      return (value: boolean) => {
        // Simply toggling the attribute will not work.
        if (value) {
          element.setAttribute(attributeName, '');
        } else {
          element.removeAttribute(attributeName);
        }
      };
    case Array:
      return (value: any[]) => element.setAttribute(attributeName, JSON.stringify(value) || '[]');
    case Object:
      return (value: Record<any, any>) => element.setAttribute(attributeName, JSON.stringify(value) || '{}');
    default:
      return (value: string) => element.setAttribute(attributeName, value || '');
  }
}
