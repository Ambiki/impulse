import type { ImpulseElement } from '../element';
import type { Registry, RegistryEntry } from '../registry';
import { classMetadata, register } from '../registry';

/**
 * A decorator for a public instance field of an Impulse element. TypeScript hands a method or accessor decorator its
 * property descriptor as a third argument, so typing that argument as `undefined` rejects them at compile time.
 */
export type FieldDecorator = (proto: ImpulseElement, key: string, descriptor?: undefined) => void;

/**
 * A decorator that records each field it decorates as a Declaration under `registry`, with the entry `entryFor` makes
 * for the field's name. `name` is how the decorator is spelled in errors, such as `@property()`.
 *
 * Throws a `TypeError` for anything but a public instance field named by a string, since a Declaration is looked up
 * by name on each element.
 */
export function fieldDecorator<T extends RegistryEntry>(
  name: string,
  registry: Registry<T>,
  entryFor: (key: string) => T,
): FieldDecorator {
  return (proto: unknown, key: unknown, descriptor?: unknown) => {
    const misplaced = legacyMisplacement(proto, key, descriptor);
    if (misplaced) throw new TypeError(`${name} can only decorate a public instance field, not ${misplaced}.`);

    register(classMetadata((proto as object).constructor), registry, entryFor(key as string));
  };
}

/**
 * What a legacy decorator was placed on, when it is not a public instance field named by a string. tsc and esbuild
 * hand a field decorator no descriptor, and Babel one with an `initializer`; a method or accessor's has a `value` or a
 * `get` and `set`. A static member's decorator is handed the class rather than its prototype.
 */
function legacyMisplacement(proto: unknown, key: unknown, descriptor: unknown): string | undefined {
  const name = typeof key === 'symbol' ? key.toString() : `"${String(key)}"`;
  if (typeof proto === 'function') return `the static member ${name}`;
  if (descriptor !== undefined && !(descriptor !== null && typeof descriptor === 'object' && 'initializer' in descriptor)) {
    return `${typeof (descriptor as PropertyDescriptor).value === 'function' ? 'the method' : 'the accessor'} ${name}`;
  }
  if (typeof key === 'symbol') return `the field ${name}`;
}
