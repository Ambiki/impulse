import type { PropertyDeclaration } from './decorators/property';
import type { TargetDeclaration } from './decorators/target';

// Standard decorators hand a class's metadata object to its decorators only when `Symbol.metadata` exists (tsc), or
// keep it under `Symbol.for('Symbol.metadata')` when it doesn't (esbuild, Babel). Defining it as that registered symbol
// makes every emitter agree. One defined before Impulse loaded (by Lit, say) is kept, so it is read at call time.
(Symbol as unknown as { metadata?: symbol }).metadata ??= Symbol.for('Symbol.metadata');

const REGISTRIES = Symbol.for('impulse');

declare const entryType: unique symbol;

/**
 * Every registration is made against a class field, and the field name is what it is looked up by.
 */
export interface RegistryEntry {
  key: string;
}

/**
 * A named collection of Declarations of one kind. The token carries the entry type, so a registry can only ever be
 * written and read with matching values: passing {@link TARGETS} where {@link PropertyDeclaration} entries are expected
 * is a type error rather than a silently empty map.
 */
export interface Registry<T extends RegistryEntry> {
  readonly name: string;
  /**
   * Phantom marker that pins `T` to the token. It is what makes {@link PROPERTIES} and {@link TARGETS} distinct types
   * rather than structurally identical `{ name: string }`s, and is never present at runtime.
   */
  readonly [entryType]?: T;
}

/**
 * Fields declared with `@property()`, read back by `Property` and `observedAttributes`.
 */
export const PROPERTIES: Registry<PropertyDeclaration> = { name: 'property' };

/**
 * Fields declared with `@target()` / `@targets()`, read back by `Target`.
 */
export const TARGETS: Registry<TargetDeclaration> = { name: 'target' };

/**
 * A class's Declarations, kept on its metadata object.
 */
interface Registries {
  /** Each registry's entries by field name: the ones the class inherits, and its own in their place. */
  readonly entries: Map<string, Map<string, RegistryEntry>>;
  /** The fields the class declares itself. */
  readonly declared: Set<string>;
}

function metadataKey(): symbol {
  return (Symbol as unknown as { metadata: symbol }).metadata;
}

/**
 * The metadata object a legacy decorator records `ctor`'s Declarations on: its own `Symbol.metadata`, created the way
 * the standard emitters create it, chained to its superclass's. So a class compiled either way reads its superclass's
 * Declarations through the chain, whichever way the superclass was compiled.
 */
export function classMetadata(ctor: object): object {
  const key = metadataKey();
  if (!Object.hasOwn(ctor, key)) {
    const inherited = (Object.getPrototypeOf(ctor) as Record<symbol, object | null | undefined>)[key] ?? null;
    Object.defineProperty(ctor, key, {
      value: Object.create(inherited),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return (ctor as Record<symbol, object>)[key];
}

/**
 * Records `entry` under `registry` on `metadata`, keyed by its field name. A field has one Declaration, so it replaces
 * an inherited Declaration of the same field, of any kind. The index is built here, once per field when the class is
 * defined, so a lookup on an instance hot path (an attribute change, a matched target token) is a single `Map#get`.
 *
 * Throws for a field the class has declared already.
 */
export function register<T extends RegistryEntry>(metadata: object, registry: Registry<T>, entry: T): void {
  const registries = ownRegistries(metadata) ?? createRegistries(metadata);
  if (registries.declared.has(entry.key)) {
    throw new TypeError(
      `The field "${entry.key}" is declared twice in one class. Declare it with one of @property(), @target(), or ` +
      `@targets().`,
    );
  }
  registries.declared.add(entry.key);

  for (const [name, entries] of registries.entries) {
    if (name !== registry.name) entries.delete(entry.key);
  }
  let entries = registries.entries.get(registry.name);
  if (!entries) {
    entries = new Map();
    registries.entries.set(registry.name, entries);
  }
  entries.set(entry.key, entry);
}

/**
 * The entries recorded under `registry` for the class `ctor` by field name, inherited ones included, or an empty map
 * when there are none. Reading never allocates on the class or its metadata.
 *
 * The miss returns a fresh map rather than a shared empty one: `ReadonlyMap` is erased at runtime, so a single cast
 * on a shared instance would leak entries into every class that declared nothing.
 */
export function registered<T extends RegistryEntry>(ctor: object, registry: Registry<T>): ReadonlyMap<string, T> {
  const metadata = (ctor as Record<symbol, object | null | undefined>)[metadataKey()];
  // Through the metadata chain: the nearest class with Declarations of its own holds the inherited ones too.
  const registries = metadata ? (metadata as Record<symbol, Registries | undefined>)[REGISTRIES] : undefined;
  return (registries?.entries.get(registry.name) as ReadonlyMap<string, T> | undefined) ?? new Map<string, T>();
}

/**
 * The entries recorded under `registry` for the class of `instance`: {@link registered} for callers holding an element
 * rather than a class.
 *
 * Safe to call once from a field initializer and keep: an upgraded custom element has its prototype swapped inside
 * `super()`, before any field initializer runs, so construction already sees the class the element ended up as. The
 * map handed back is the class's own, so it is a reference to hold rather than a copy to rebuild.
 */
export function registeredFor<T extends RegistryEntry>(
  instance: object,
  registry: Registry<T>,
): ReadonlyMap<string, T> {
  return registered((Object.getPrototypeOf(instance) as { constructor: object }).constructor, registry);
}

function ownRegistries(metadata: object): Registries | undefined {
  if (!Object.hasOwn(metadata, REGISTRIES)) return;
  return (metadata as Record<symbol, Registries>)[REGISTRIES];
}

/**
 * Gives `metadata` its own Declarations, starting from a copy of the ones it inherits. A class is only defined once
 * its superclass is, so the superclass's are final by then.
 */
function createRegistries(metadata: object): Registries {
  const inherited = (metadata as Record<symbol, Registries | undefined>)[REGISTRIES];
  const registries: Registries = {
    entries: new Map(Array.from(inherited?.entries ?? [], ([name, entries]) => [name, new Map(entries)])),
    declared: new Set(),
  };
  Object.defineProperty(metadata, REGISTRIES, { value: registries, configurable: true });
  return registries;
}
