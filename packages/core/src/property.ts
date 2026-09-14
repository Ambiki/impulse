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

/**
 * Returns whether a converted attribute value is unchanged, and so must not fire `[property]Changed`.
 *
 * Primitives compare with `Object.is` so a Number that transforms to `NaN` on both sides (e.g. a non-numeric value
 * replaced with another) counts as unchanged. `Array` and `Object` cannot compare that way: `fromAttribute` parses a
 * fresh value on every call, so the two sides are never the same reference no matter what they hold. They compare
 * structurally instead, which also makes a reformatted but equal write (`{ "foo": "bar" }` to `{"foo":"bar"}`) the
 * no-op it reads as.
 *
 * @example
 * isUnchanged(['Guava'], ['Guava'], Array);
 * //=> true
 */
export function isUnchanged(newValue: unknown, oldValue: unknown, type: PropertyConstructor) {
  switch (type) {
    case Array:
    case Object:
      return isDeepEqual(newValue, oldValue);
    default:
      return Object.is(newValue, oldValue);
  }
}

/**
 * Structural comparison of two parsed JSON values. Both sides come out of `JSON.parse`, so there are no cycles, no
 * prototypes, and no wrapper types to account for — only objects, arrays, and primitives. Key order is not part of an
 * object's value, but element order is part of an array's. The comparison is symmetric, so the arguments are named
 * `left`/`right` rather than new/old: past the first level they are no longer either.
 */
function isDeepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== 'object' || typeof right !== 'object' || left === null || right === null) return false;

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => isDeepEqual(value, right[index]));
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(
    (key) =>
      Object.hasOwn(right, key) &&
      isDeepEqual((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
  );
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
