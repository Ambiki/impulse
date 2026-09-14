import Store from '../store';

/**
 * A single `@property()` registration: the field name and the constructor its attribute value is converted with.
 */
export interface PropertyType {
  key: string;
  type: PropertyConstructor;
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
 * `content-type`) converted to `type`, and assigning to it writes the attribute back.
 *
 * The decorator only records the field; `Property` defines the accessors when the element connects, which is what lets
 * a field initializer act as the default value. Declaring a property also registers the attribute as observed, so a
 * `[field]Changed(newValue, oldValue)` method is invoked when the converted value changes.
 *
 * @param options - Optional settings.
 * @param options.type - The type to convert the attribute to. Defaults to `String`.
 *
 * @example
 * ```ts
 * @registerElement('pop-over')
 * export default class PopOverElement extends ImpulseElement {
 *   @property() src: string;
 *   @property({ type: Boolean }) open = false;
 *
 *   srcChanged(newValue: string, oldValue: string) {
 *     // ...
 *   }
 * }
 * ```
 */
export function property({ type = String }: { type?: PropertyConstructor } = {}) {
  return (ctor: any, key: string) => {
    const store = new Store<PropertyType>(ctor, 'property');
    store.add({ key, type });
  };
}
