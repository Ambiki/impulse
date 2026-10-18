import type { PropertyConstructor, PropertyDeclaration } from './decorators/property';
import type { ImpulseElement } from './element';
import { dasherize, parseJSON } from './helpers/string';
import { PROPERTIES, registeredFor } from './registry';

export default class Property {
  readonly declarations: ReadonlyMap<string, PropertyDeclaration>;
  private readonly defaults = new Map<string, unknown>();

  constructor(private readonly instance: ImpulseElement) {
    this.declarations = registeredFor(this.instance, PROPERTIES);
  }

  start() {
    for (const { key, type } of this.declarations.values()) {
      // The Default is captured on the first start only. On a reconnect the field is already an accessor, and reading
      // it would capture whatever the attribute holds by then.
      if (this.defaults.has(key)) continue;
      this.initializeProperty(key, type);
    }
  }

  /**
   * Converts an attribute value of the property `key` the way its getter does, so `[property]Changed` receives
   * exactly what the getter reads before and after the change.
   */
  read(key: string, value: string | null) {
    const { type } = this.declarations.get(key)!;
    return fromAttribute(value, type, () => this.defaultOf(key, type));
  }

  stop() {
    // No-op: the accessors delegate to the element's attributes, and the Defaults are kept for a reconnect, so there is
    // nothing to tear down when the element disconnects.
  }

  private defaultOf(key: string, type: PropertyConstructor) {
    const value = this.defaults.get(key);
    // A copy, as parsing the attribute would give, so mutating what the getter returns never changes the Default.
    return type === Array || type === Object ? JSON.parse(JSON.stringify(value)) : value;
  }

  private initializeProperty(key: string, type: PropertyConstructor) {
    const attributeName = dasherize(key);
    // A field initializer and a value assigned before the element connected are both an own value here, and both
    // become the Default.
    const value = (this.instance as unknown as Record<string, unknown>)[key];
    const defaultValue = value ?? emptyValue(type);
    this.defaults.set(key, defaultValue);

    Object.defineProperty(this.instance, key, {
      configurable: true,
      get: () => this.read(key, this.instance.getAttribute(attributeName)),
      set: toAttribute(this.instance, attributeName, type, defaultValue),
    });
  }
}

/**
 * Converts an attribute value into the value of its `@property()` for the given type.
 *
 * Both the property getter and `attributeChangedCallback` read through this, so `this.prop` and the value handed to
 * `[property]Changed` can never disagree. A missing attribute (`null`) reads as the Default, and so does one that does
 * not parse as its type: an empty or non-numeric Number, or JSON that is invalid or of the wrong kind for an Array or
 * Object. Any string is a valid String, and a Boolean only looks at whether the attribute is present and not
 * `"false"`.
 *
 * @example
 * fromAttribute('8_000', Number, () => 0);
 * //=> 8000
 *
 * fromAttribute('abc', Number, () => 12);
 * //=> 12
 */
function fromAttribute(value: string | null, type: PropertyConstructor, readDefault: () => unknown) {
  if (value === null) return readDefault();

  switch (type) {
    case Number: {
      const digits = value.replace(/_/g, '').trim();
      const number = Number(digits);
      return digits === '' || Number.isNaN(number) ? readDefault() : number;
    }
    case Boolean:
      return value !== 'false';
    case Array: {
      const parsed = parseJSON(value, null);
      return Array.isArray(parsed) ? parsed : readDefault();
    }
    case Object: {
      const parsed = parseJSON(value, null);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : readDefault();
    }
    default:
      return value;
  }
}

/**
 * The Empty value of a property type: what it holds when it holds nothing. It is the Default of a property declared
 * without one.
 */
function emptyValue(type: PropertyConstructor) {
  switch (type) {
    case Number:
      return 0;
    case Boolean:
      return false;
    case Array:
      return [];
    case Object:
      return {};
    default:
      return '';
  }
}

/**
 * Returns the setter that writes a property value back to its attribute. Kept beside `fromAttribute` so the two
 * halves of the conversion stay in step, case for case.
 */
function toAttribute(element: Element, attributeName: string, type: PropertyConstructor, defaultValue: unknown) {
  return (value: unknown) => {
    const attribute = serialize(value, type, defaultValue);
    if (attribute === null) {
      element.removeAttribute(attributeName);
    } else {
      element.setAttribute(attributeName, attribute);
    }
  };
}

/**
 * The attribute value a property value is written as, or `null` when the attribute is removed instead.
 */
function serialize(value: unknown, type: PropertyConstructor, defaultValue: unknown): string | null {
  // Assigning nothing removes the attribute, so the property reads its Default again.
  if (value === null || value === undefined) return null;

  switch (type) {
    case Number:
      return ((value as number) || 0).toString();
    case Boolean:
      if (value) return '';
      // A missing attribute would read as a `true` Default, so `false` has to be spelled out.
      return defaultValue ? 'false' : null;
    case Array:
    case Object:
      return JSON.stringify(value);
    default:
      return String(value);
  }
}
