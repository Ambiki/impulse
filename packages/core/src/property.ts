import type { PropertyConstructor, PropertyDeclaration } from './decorators/property';
import type { ImpulseElement } from './element';
import { isDeepEqual } from './helpers/equality';
import { invokeReporting } from './helpers/errors';
import { camelize, dasherize, parseJSON } from './helpers/string';
import { PROPERTIES, registered, registeredFor } from './registry';

const properties = new WeakMap<Element, Property>();

// Each class's `keysByAttribute`, built on first use. Decorators have all run by then, since a class is defined, and
// its attributes observed, only once its body has been evaluated.
const attributeIndexes = new WeakMap<ReadonlyMap<string, PropertyDeclaration>, ReadonlyMap<string, string[]>>();

/**
 * The `@property()` keys in `declarations` by the attribute each reads: the key dasherized, so `contentType` reads
 * `content-type` and `userID` reads `user-id`. Two keys can read one attribute (`fooURL` and `fooUrl`).
 */
function keysByAttribute(declarations: ReadonlyMap<string, PropertyDeclaration>): ReadonlyMap<string, string[]> {
  const cached = attributeIndexes.get(declarations);
  if (cached) return cached;

  const index = new Map<string, string[]>();
  for (const { key } of declarations.values()) {
    const attribute = dasherize(key);
    const keys = index.get(attribute);
    if (keys) keys.push(key);
    else index.set(attribute, [key]);
  }
  attributeIndexes.set(declarations, index);
  return index;
}

/**
 * The attributes an element of the class `ctor` observes: one for each attribute its `@property()` fields read,
 * inherited ones included.
 */
export function observedAttributes(ctor: object): string[] {
  return Array.from(keysByAttribute(registered(ctor, PROPERTIES)).keys());
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
   * attribute removed while it read as the Default. A callback that throws is reported like an uncaught error, so the
   * callbacks of other fields reading the same attribute still run.
   *
   * Throws for an attribute no field reads, such as one a subclass adds to `observedAttributes`, when the element has a
   * `[camelized attribute]Changed` method, since it would never be invoked.
   */
  attributeChanged(attribute: string, oldAttribute: string | null, newAttribute: string | null) {
    const instance = this.instance as unknown as Record<string, unknown>;
    const keys = keysByAttribute(this.declarations).get(attribute);
    if (!keys) {
      const hasChangeCallback = typeof instance[`${camelize(attribute)}Changed`] === 'function';
      if (hasChangeCallback) {
        throw new Error(
          `Unregistered attribute changed: ${attribute}. Register the attribute using the @property() decorator.`,
        );
      }
      return;
    }

    for (const key of keys) {
      const fn = instance[`${key}Changed`];
      if (typeof fn !== 'function') continue;
      // Every field is bound by the time its attribute changes are reported: `start()` binds them before the element
      // can be Initialized.
      const change = this.bound.get(key)!.change(oldAttribute, newAttribute);
      if (change) invokeReporting(() => fn.call(this.instance, change.newValue, change.oldValue));
    }
  }
}

/**
 * A property's Type: how it reads its attribute as a value, how it writes a value back to that attribute, and which two
 * values are the same. A Type never sees nothing: a missing attribute and an assignment of `null` or `undefined` are
 * handled before it is asked.
 */
interface PropertyType<T> {
  /**
   * The value `attribute` holds, or `null` or `undefined` when it does not parse, so the property reads its Default.
   * Never called for a missing attribute, which reads as the Default without asking.
   */
  fromAttribute: (attribute: string) => T | null | undefined;
  /**
   * The attribute `value` is written as, or `null` to remove the attribute, after which the property reads
   * `defaultValue`. Never called with `null` or `undefined`, since assigning either removes the attribute without asking.
   */
  toAttribute: (value: T, defaultValue: T | null) => string | null;
  /** Whether two values are the same, so a change from one to the other is not reported. */
  isEqual: (left: T, right: T) => boolean;
  /**
   * The Empty value: what a property reads while its attribute is missing and it has no Default. Never handed out
   * itself, since the Default is read as an attribute holding it would be, so a mutable one is safe to share.
   */
  emptyValue: T;
}

/**
 * An Array or Object Type, stored as JSON. A value parsed from an attribute is a fresh one on every read, so values
 * compare structurally.
 */
function jsonType<T>(isKind: (value: unknown) => value is T, emptyValue: T): PropertyType<T> {
  return {
    fromAttribute(attribute) {
      const parsed = parseJSON(attribute, null);
      return isKind(parsed) ? parsed : undefined;
    },
    toAttribute: (value) => JSON.stringify(value),
    isEqual: isDeepEqual,
    emptyValue,
  };
}

/**
 * A Type of any values. Its functions take only its own values, so Types of different values can be held together, or
 * handed values read through themselves, only as `any`.
 */
type AnyPropertyType = PropertyType<any>;

const PROPERTY_TYPES = new Map<PropertyConstructor, AnyPropertyType>([
  [
    String,
    {
      // Any string is a String, the empty one included.
      fromAttribute: (attribute) => attribute,
      toAttribute: String,
      isEqual: Object.is,
      emptyValue: '',
    } satisfies PropertyType<string>,
  ],
  [
    Number,
    {
      fromAttribute(attribute) {
        const digits = attribute.replace(/_/g, '').trim();
        const number = Number(digits);
        return digits === '' || Number.isNaN(number) ? undefined : number;
      },
      toAttribute: String,
      isEqual: Object.is,
      emptyValue: 0,
    } satisfies PropertyType<number>,
  ],
  [
    Boolean,
    {
      fromAttribute: (attribute) => attribute !== 'false',
      toAttribute(value, defaultValue) {
        if (value) return '';
        // A missing attribute would read as a `true` Default, so `false` has to be spelled out.
        return defaultValue ? 'false' : null;
      },
      isEqual: Object.is,
      emptyValue: false,
    } satisfies PropertyType<boolean>,
  ],
  [Array, jsonType((value): value is unknown[] => Array.isArray(value), [])],
  [
    Object,
    jsonType(
      (value): value is object => typeof value === 'object' && value !== null && !Array.isArray(value),
      {},
    ),
  ],
]);

/**
 * One `@property()` of one element: its attribute, its type, and its Default.
 */
class BoundProperty {
  private readonly attributeName: string;
  private readonly type: AnyPropertyType;
  private readonly defaultValue: unknown;

  constructor(
    private readonly element: Element,
    private readonly key: string,
    type: PropertyConstructor,
    defaultValue: unknown,
  ) {
    this.attributeName = dasherize(key);
    this.type = PROPERTY_TYPES.get(type)!;
    this.defaultValue = defaultValue ?? this.type.emptyValue;
  }

  get value() {
    return this.read(this.element.getAttribute(this.attributeName));
  }

  write(value: unknown) {
    // Assigning nothing removes the attribute, so the property reads its Default again.
    const attribute = isNothing(value) ? null : this.type.toAttribute(value, this.defaultValue);
    if (attribute === null) {
      this.element.removeAttribute(this.attributeName);
    } else {
      this.element.setAttribute(this.attributeName, attribute);
    }
  }

  change(oldAttribute: string | null, newAttribute: string | null) {
    const oldValue = this.read(oldAttribute);
    const newValue = this.read(newAttribute);
    return this.type.isEqual(newValue, oldValue) ? null : { newValue, oldValue };
  }

  /**
   * Converts an attribute value into the property's value. Both the getter and `change` read through this, so
   * `this.prop` and the values handed to `[property]Changed` can never disagree. A missing attribute reads as the
   * Default, and so does one that does not parse as the Type.
   */
  private read(attribute: string | null) {
    const value = this.parse(attribute);
    return isNothing(value) ? this.readDefault() : value;
  }

  /**
   * The Default, read as an attribute holding it would be: written with the Type and parsed back. A missing attribute
   * therefore reads the same as one holding the Default, and every read is a fresh value, so mutating what the getter
   * returns never changes the Default.
   *
   * A Default that does not survive the trip, because the Type writes it as no attribute or cannot read back what it
   * wrote, reads as itself when it is a primitive, which nothing can mutate. An object is never handed out itself, so
   * reading one throws.
   */
  private readDefault() {
    const value = this.parse(this.type.toAttribute(this.defaultValue, this.defaultValue));
    if (!isNothing(value)) return value;
    if (!isMutable(this.defaultValue)) return this.defaultValue;
    throw new TypeError(
      `@property() on the field "${this.key}" cannot read its Default, since its Type does not write it as an ` +
      `attribute it reads back, and handing out the object itself would let a mutation change the Default.`,
    );
  }

  /** The value `attribute` holds, or nothing when it is missing or does not parse as the Type. */
  private parse(attribute: string | null) {
    return attribute === null ? undefined : this.type.fromAttribute(attribute);
  }
}

function isNothing(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/** Whether `value` can be changed in place, as an object or function can and a primitive cannot. */
function isMutable(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}
