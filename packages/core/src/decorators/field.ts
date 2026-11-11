import type { ImpulseElement } from '../element';
import type { Registry, RegistryEntry } from '../registry';
import { classMetadata, register } from '../registry';

/**
 * A decorator for a public instance field of an Impulse element. TypeScript hands a method or accessor decorator its
 * property descriptor as a third argument, so typing that argument as `undefined` rejects them at compile time.
 */
export type FieldDecorator = (proto: ImpulseElement, key: string, descriptor?: undefined) => void;

/**
 * A decorator that records each field it decorates under `registry`, as the Declaration `declarationFor` makes for the
 * field's name. `decorator` is how the decorator is spelled in errors, such as `@property()`.
 *
 * Throws a `TypeError` for anything but a public instance field named by a string, since a Declaration is looked up
 * by name on each element.
 */
export function fieldDecorator<T extends RegistryEntry>(
  decorator: string,
  registry: Registry<T>,
  declarationFor: (key: string) => T,
): FieldDecorator {
  return (proto: unknown, key: unknown, descriptor?: unknown) => {
    const misplaced = legacyMisplacement(proto, key, descriptor);
    if (misplaced) throw new TypeError(`${decorator} can only decorate a public instance field, not ${misplaced}.`);

    register(classMetadata((proto as object).constructor), registry, declarationFor(key as string));
  };
}

/**
 * What a legacy decorator was placed on, when it is not a public instance field named by a string. A static member's
 * decorator is handed the class rather than its prototype.
 */
function legacyMisplacement(proto: unknown, key: unknown, descriptor: unknown): string | undefined {
  const name = typeof key === 'symbol' ? key.toString() : `"${String(key)}"`;
  if (typeof proto === 'function') return `the static member ${name}`;
  if (!isFieldDescriptor(descriptor)) {
    return `${typeof (descriptor as PropertyDescriptor).value === 'function' ? 'the method' : 'the accessor'} ${name}`;
  }
  if (typeof key === 'symbol') return `the field ${name}`;
}

/**
 * Whether a legacy decorator was handed a field's descriptor: tsc and esbuild hand a field decorator none, and Babel
 * one with an `initializer`, while a method or accessor's has a `value`, or a `get` and `set`.
 */
function isFieldDescriptor(descriptor: unknown): boolean {
  if (descriptor === undefined) return true;
  return typeof descriptor === 'object' && descriptor !== null && 'initializer' in descriptor;
}
