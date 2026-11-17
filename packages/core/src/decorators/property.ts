import type { FieldDecorator } from './field';
import { PROPERTIES } from '../registry';
import { fieldDecorator } from './field';

/**
 * A single `@property()` declaration: the field name and the Type its attribute is read and written with, as a built-in
 * constructor or a Type of the author's own.
 */
export interface PropertyDeclaration {
  key: string;
  // `any`: a Type's functions take only its own values, so Types of different values share no narrower type.
  type: PropertyConstructor | PropertyType<any>;
}

/**
 * A property's Type: how it reads its attribute as a value, how it writes a value back to that attribute, and which two
 * values are the same. A Type never sees nothing: a missing attribute and an assignment of `null` or `undefined` are
 * handled before it is asked.
 *
 * @example
 * ```ts
 * const dateType = {
 *   fromAttribute(attribute) {
 *     const date = new Date(attribute);
 *     return Number.isNaN(date.getTime()) ? undefined : date;
 *   },
 *   toAttribute: (date) => date.toISOString(),
 * } satisfies PropertyType<Date>;
 * ```
 */
export interface PropertyType<T> {
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
  isEqual?: (left: T, right: T) => boolean;
  /**
   * The Empty value: what a property reads while its attribute is missing and it has no Default. `null` when omitted.
   */
  emptyValue?: T;
}

/**
 * The types a property can be declared as. `String` is the default.
 */
export type PropertyConstructor =
  | StringConstructor |
  BooleanConstructor |
  NumberConstructor |
  ArrayConstructor |
  ObjectConstructor;

/**
 * Backs a field by an HTML attribute. Reading the field reads the dasherized attribute (`contentType` reads
 * `content-type`) through its Type, and assigning to it writes the attribute back.
 *
 * The decorator only records the field; `Property` defines the accessors when the element connects, which is what lets
 * a field initializer act as the default value. Declaring a property also registers the attribute as observed, so a
 * `[field]Changed(newValue, oldValue)` method is invoked when the converted value changes.
 *
 * @param options - Optional settings.
 * @param options.type - The Type the attribute is read and written with: `String`, `Number`, `Boolean`, `Array`, or
 * `Object`, or a {@link PropertyType} of your own. Defaults to `String`.
 *
 * @example
 * ```ts
 * @registerElement('pop-over')
 * export default class PopOverElement extends ImpulseElement {
 *   @property() src: string;
 *   @property({ type: Boolean }) open = false;
 *   @property({ type: dateType }) closesAt: Date | null;
 *
 *   srcChanged(newValue: string, oldValue: string) {
 *     // ...
 *   }
 * }
 * ```
 */
// `any`: a Type's functions take only its own values, so Types of different values share no narrower type.
export function property({ type = String }: { type?: PropertyConstructor | PropertyType<any> } = {}): FieldDecorator {
  return fieldDecorator('@property()', PROPERTIES, (key) => {
    assertPropertyType(key, type);
    return { key, type };
  });
}

const BUILT_IN_TYPES: readonly unknown[] = [String, Number, Boolean, Array, Object];

/**
 * Throws a `TypeError` naming the field `key` unless `type` is a built-in constructor or a Type, so a mistake surfaces
 * when the class is defined rather than when an element first reads the property.
 */
function assertPropertyType(key: string, type: unknown) {
  if (BUILT_IN_TYPES.includes(type)) return;

  const { fromAttribute, toAttribute, isEqual } = (type ?? {}) as Partial<Record<keyof PropertyType<unknown>, unknown>>;
  if (typeof fromAttribute !== 'function' || typeof toAttribute !== 'function') {
    throw new TypeError(
      `@property() on the field "${key}" takes a type of String, Number, Boolean, Array, or Object, or a Type with ` +
      `fromAttribute and toAttribute functions, not ${describeType(type)}.`,
    );
  }
  if (isEqual !== undefined && typeof isEqual !== 'function') {
    throw new TypeError(`@property() on the field "${key}" takes a Type whose isEqual, if it has one, is a function.`);
  }
}

function describeType(type: unknown): string {
  if (typeof type === 'function') return type.name || 'an anonymous function';
  if (typeof type === 'object' && type !== null) return 'an object without them';
  return typeof type === 'string' ? JSON.stringify(type) : String(type);
}
