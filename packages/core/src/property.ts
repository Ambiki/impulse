import type { PropertyConstructor, PropertyDeclaration } from './decorators/property';
import type { ImpulseElement } from './element';
import { isDeepEqual } from './helpers/equality';
import { dasherize, parseJSON } from './helpers/string';
import { PROPERTIES, registeredFor } from './registry';

export default class Property {
  private readonly declarations: ReadonlyMap<string, PropertyDeclaration>;
  private readonly bound = new Map<string, BoundProperty>();

  constructor(private readonly instance: ImpulseElement) {
    this.declarations = registeredFor(this.instance, PROPERTIES);
  }

  start() {
    for (const { key, type } of this.declarations.values()) {
      // Bound on the first start only. On a reconnect the field is already an accessor, and reading it would take
      // whatever the attribute holds by then for the Default.
      if (this.bound.has(key)) continue;

      const property = new BoundProperty(this.instance, key, type);
      this.bound.set(key, property);
      Object.defineProperty(this.instance, key, {
        configurable: true,
        get: () => property.value,
        set: (value: unknown) => property.write(value),
      });
    }
  }

  stop() {
    // No-op: the accessors delegate to the element's attributes, and the Defaults are kept for a reconnect, so there is
    // nothing to tear down when the element disconnects.
  }

  /**
   * Returns the values `[property]Changed` receives when the attribute of the property `key` goes from `oldAttribute`
   * to `newAttribute`, or `null` when both read as the same value, so nothing changed: `8_000` rewritten as `8000`,
   * reformatted JSON, or an attribute removed while it read as the Default.
   */
  change(key: string, oldAttribute: string | null, newAttribute: string | null) {
    const property = this.bound.get(key);
    if (!property) {
      throw new Error(
        `Unregistered attribute changed: ${dasherize(key)}. Register the attribute using the @property() decorator.`,
      );
    }
    return property.change(oldAttribute, newAttribute);
  }
}

/**
 * How the values of one property type are read from and written to an attribute.
 */
interface PropertyType {
  /** The Empty value. A new one on every call, so no two properties share an Array or Object. */
  empty: () => unknown;
  /** The value `attribute` holds, or `undefined` when it does not parse as this type. */
  fromAttribute: (attribute: string) => unknown;
  /** The attribute `value` is written as, or `null` when the attribute is removed instead. */
  toAttribute: (value: unknown, defaultValue: unknown) => string | null;
  /** Whether two values are the same, so a change from one to the other is not reported. */
  equals: (left: unknown, right: unknown) => boolean;
  /** A copy of `value` that is safe to mutate. */
  copy: (value: unknown) => unknown;
}

const identity = (value: unknown) => value;

/**
 * An Array or Object type, stored as JSON. A value parsed from an attribute is a fresh one on every read, so values
 * compare structurally, and copies go through JSON too, so a copy of the Default is what parsing it would give.
 */
function jsonType(isKind: (value: unknown) => boolean, empty: () => unknown): PropertyType {
  return {
    empty,
    fromAttribute: (attribute) => {
      const parsed = parseJSON(attribute, null);
      return isKind(parsed) ? parsed : undefined;
    },
    toAttribute: (value) => JSON.stringify(value),
    equals: isDeepEqual,
    copy: (value) => JSON.parse(JSON.stringify(value)),
  };
}

const PROPERTY_TYPES = new Map<PropertyConstructor, PropertyType>([
  [
    String,
    {
      empty: () => '',
      // Any string is a String, the empty one included.
      fromAttribute: identity,
      toAttribute: String,
      equals: Object.is,
      copy: identity,
    },
  ],
  [
    Number,
    {
      empty: () => 0,
      fromAttribute: (attribute) => {
        const digits = attribute.replace(/_/g, '').trim();
        const number = Number(digits);
        return digits === '' || Number.isNaN(number) ? undefined : number;
      },
      toAttribute: (value) => ((value as number) || 0).toString(),
      equals: Object.is,
      copy: identity,
    },
  ],
  [
    Boolean,
    {
      empty: () => false,
      fromAttribute: (attribute) => attribute !== 'false',
      toAttribute: (value, defaultValue) => {
        if (value) return '';
        // A missing attribute would read as a `true` Default, so `false` has to be spelled out.
        return defaultValue ? 'false' : null;
      },
      equals: Object.is,
      copy: identity,
    },
  ],
  [Array, jsonType(Array.isArray, () => [])],
  [Object, jsonType((value) => typeof value === 'object' && value !== null && !Array.isArray(value), () => ({}))],
]);

/**
 * One `@property()` of one element: its attribute, its type, and its Default.
 */
class BoundProperty {
  private readonly attributeName: string;
  private readonly type: PropertyType;
  private readonly defaultValue: unknown;

  constructor(private readonly element: Element, key: string, type: PropertyConstructor) {
    this.attributeName = dasherize(key);
    this.type = PROPERTY_TYPES.get(type)!;
    // A field initializer and a value assigned before the element connected are both an own value here, and both
    // become the Default.
    this.defaultValue = (element as unknown as Record<string, unknown>)[key] ?? this.type.empty();
  }

  get value() {
    return this.read(this.element.getAttribute(this.attributeName));
  }

  write(value: unknown) {
    // Assigning nothing removes the attribute, so the property reads its Default again.
    const attribute = value === null || value === undefined ? null : this.type.toAttribute(value, this.defaultValue);
    if (attribute === null) {
      this.element.removeAttribute(this.attributeName);
    } else {
      this.element.setAttribute(this.attributeName, attribute);
    }
  }

  change(oldAttribute: string | null, newAttribute: string | null) {
    const oldValue = this.read(oldAttribute);
    const newValue = this.read(newAttribute);
    return this.type.equals(newValue, oldValue) ? null : { newValue, oldValue };
  }

  /**
   * Converts an attribute value into the property's value. Both the getter and `change` read through this, so
   * `this.prop` and the values handed to `[property]Changed` can never disagree. A missing attribute reads as the
   * Default, and so does one that does not parse as the type.
   */
  private read(attribute: string | null) {
    const value = attribute === null ? undefined : this.type.fromAttribute(attribute);
    // A copy, as parsing an attribute would give, so mutating what the getter returns never changes the Default.
    return value === undefined ? this.type.copy(this.defaultValue) : value;
  }
}
