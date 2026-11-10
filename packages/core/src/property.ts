import type { PropertyConstructor, PropertyDeclaration } from './decorators/property';
import type { ImpulseElement } from './element';
import { isDeepEqual } from './helpers/equality';
import { invokeEach } from './helpers/invoke_each';
import { camelize, dasherize, parseJSON } from './helpers/string';
import { PROPERTIES, registered, registeredFor } from './registry';

const properties = new WeakMap<Element, Property>();

// The `@property()` fields of each class by the attribute they read, built on first use. Decorators have all run by
// then, since a class is defined, and its attributes observed, only once its body has been evaluated.
const fieldsByAttribute = new WeakMap<ReadonlyMap<string, PropertyDeclaration>, ReadonlyMap<string, string[]>>();

/**
 * The fields declared in `declarations` by the attribute each reads: the field name dasherized, so `contentType`
 * reads `content-type` and `userID` reads `user-id`. Two fields can read one attribute (`fooURL` and `fooUrl`).
 */
function fieldsReading(declarations: ReadonlyMap<string, PropertyDeclaration>): ReadonlyMap<string, string[]> {
  const cached = fieldsByAttribute.get(declarations);
  if (cached) return cached;

  const fields = new Map<string, string[]>();
  for (const { key } of declarations.values()) {
    const attribute = dasherize(key);
    const keys = fields.get(attribute);
    if (keys) keys.push(key);
    else fields.set(attribute, [key]);
  }
  fieldsByAttribute.set(declarations, fields);
  return fields;
}

/**
 * The attributes an element of the class with prototype `proto` observes: one for each attribute its `@property()`
 * fields read.
 */
export function observedAttributes(proto: object): string[] {
  return Array.from(fieldsReading(registered(proto, PROPERTIES)).keys());
}

/**
 * Binds every `@property()` of `element` now, taking the value each holds as its Default. `registerElement`'s subclass
 * calls this once construction is done, when every field initializer has run and nothing has been assigned yet, so any
 * later assignment, before the element connects or after, goes through the setter and is written to the attribute.
 */
export function bindProperties(element: Element) {
  properties.get(element)?.bind();
}

export default class Property {
  private readonly declarations: ReadonlyMap<string, PropertyDeclaration>;
  private readonly bound = new Map<string, BoundProperty>();

  constructor(private readonly instance: ImpulseElement) {
    this.declarations = registeredFor(this.instance, PROPERTIES);
    properties.set(this.instance, this);
  }

  start() {
    // Already bound at construction for a class registered with `@registerElement`. Otherwise (a class defined with
    // `customElements.define`) this is the first chance, and a value assigned before connecting can't be told from the
    // field initializer, so it is taken as the Default.
    this.bind();
  }

  /**
   * Replaces each property's field with accessors, taking the value it holds as its Default. Each property is bound
   * once: on a later call the field is already an accessor, and reading it would take whatever the attribute holds by
   * then for the Default.
   */
  bind() {
    for (const { key, type } of this.declarations.values()) {
      if (this.bound.has(key)) continue;

      const defaultValue = (this.instance as unknown as Record<string, unknown>)[key];
      const property = new BoundProperty(this.instance, key, type, defaultValue);
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
   * Invokes `[field]Changed(newValue, oldValue)` for each field that reads `attribute` and has the method, unless
   * `oldAttribute` and `newAttribute` read as the same value: `8_000` rewritten as `8000`, reformatted JSON, or an
   * attribute removed while it read as the Default. Every field's callback runs even if an earlier one throws; the
   * first error is rethrown afterwards.
   *
   * Throws for an attribute no field reads, such as one a subclass adds to `observedAttributes`, when the element has a
   * `[camelized attribute]Changed` method, since it would never be invoked.
   */
  attributeChanged(attribute: string, oldAttribute: string | null, newAttribute: string | null) {
    const instance = this.instance as unknown as Record<string, unknown>;
    const keys = fieldsReading(this.declarations).get(attribute);
    if (!keys) {
      const hasChangeCallback = typeof instance[`${camelize(attribute)}Changed`] === 'function';
      if (hasChangeCallback) {
        throw new Error(
          `Unregistered attribute changed: ${attribute}. Register the attribute using the @property() decorator.`,
        );
      }
      return;
    }

    invokeEach(keys, (key) => {
      const fn = instance[`${key}Changed`];
      if (typeof fn !== 'function') return;
      // Every field is bound by the time its attribute changes are reported: `start()` binds them before the element
      // can be Initialized.
      const change = this.bound.get(key)!.change(oldAttribute, newAttribute);
      if (change) fn.call(this.instance, change.newValue, change.oldValue);
    });
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
      toAttribute: String,
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

  constructor(private readonly element: Element, key: string, type: PropertyConstructor, defaultValue: unknown) {
    this.attributeName = dasherize(key);
    this.type = PROPERTY_TYPES.get(type)!;
    this.defaultValue = defaultValue ?? this.type.empty();
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
