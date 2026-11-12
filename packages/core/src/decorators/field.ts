import type { ImpulseElement } from '../element';
import type { Registry, RegistryEntry } from '../registry';
import { classMetadata, register } from '../registry';

/**
 * A decorator for a public instance field of an Impulse element, in either decorator convention.
 */
export interface FieldDecorator {
  /**
   * Legacy (`experimentalDecorators`). TypeScript hands a method or accessor decorator its property descriptor as a
   * third argument, so typing that argument as `undefined` rejects them at compile time.
   */
  (proto: ImpulseElement, key: string, descriptor?: undefined): void;
  /**
   * Standard. The literal `name`, `private`, and `static` TypeScript gives the context reject the members a Declaration
   * can't be made for at compile time.
   */
  <This extends ImpulseElement, Value>(
    value: undefined,
    context: ClassFieldDecoratorContext<This, Value> & { name: string; private: false; static: false },
  ): void;
}

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
  return (protoOrValue: unknown, keyOrContext: unknown, descriptor?: unknown) => {
    const context = isDecoratorContext(keyOrContext) ? keyOrContext : undefined;
    const misplaced = context ?
      standardMisplacement(context) :
      legacyMisplacement(protoOrValue, keyOrContext, descriptor);
    if (misplaced) throw new TypeError(`${decorator} can only decorate a public instance field, not ${misplaced}.`);

    if (!context) {
      register(classMetadata((protoOrValue as object).constructor), registry, declarationFor(keyOrContext as string));
      return;
    }
    if (!context.metadata) {
      throw new TypeError(
        `${decorator} needs decorator metadata, which it was not handed. Compile with TypeScript 5.2 or later, ` +
        `esbuild 0.21 or later, or Babel's 2023-11 decorators, or use legacy decorators. TypeScript also needs ` +
        `Symbol.metadata, which Impulse defines when it loads, so a class evaluated before Impulse (in an import ` +
        `cycle, say) gets none.`,
      );
    }
    register(context.metadata, registry, declarationFor(context.name as string));
  };
}

/**
 * Whether a decorator was handed a standard decorator's context, rather than a legacy one's field name.
 */
function isDecoratorContext(value: unknown): value is DecoratorContext {
  return typeof value === 'object' && value !== null && 'kind' in value;
}

function describeName(name: string | symbol | undefined): string {
  return typeof name === 'symbol' ? name.toString() : `"${String(name)}"`;
}

/**
 * What a standard decorator was placed on, when it is not a public instance field named by a string.
 */
function standardMisplacement(context: DecoratorContext): string | undefined {
  const name = describeName(context.name);
  switch (context.kind) {
    case 'field':
      break;
    case 'class':
      return `the class ${name}`;
    case 'method':
      return `the ${context.static ? 'static member' : 'method'} ${name}`;
    default:
      return `the ${context.static ? 'static member' : 'accessor'} ${name}`;
  }
  if (context.static) return `the static member ${name}`;
  if (context.private) return `the private field ${name}`;
  if (typeof context.name === 'symbol') return `the field ${name}`;
}

/**
 * What a legacy decorator was placed on, when it is not a public instance field named by a string. A static member's
 * decorator is handed the class rather than its prototype, and a class decorator only the class.
 */
function legacyMisplacement(proto: unknown, key: unknown, descriptor: unknown): string | undefined {
  const name = describeName(key as string | symbol | undefined);
  if (typeof proto === 'function') {
    return key === undefined ? `the class ${describeName(proto.name)}` : `the static member ${name}`;
  }
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
