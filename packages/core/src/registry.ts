import type { PropertyDeclaration } from './decorators/property';
import type { TargetDeclaration } from './decorators/target';

const REGISTRIES = Symbol.for('impulse');

declare const entryType: unique symbol;

/**
 * Every registration is made against a class field, and the field name is what it is looked up by.
 */
export interface RegistryEntry {
  key: string;
}

/**
 * A named collection of class-level registrations, held on the prototype the decorator ran against. The token carries
 * the entry type, so a registry can only ever be written and read with matching values: passing {@link TARGETS} where
 * {@link PropertyDeclaration} entries are expected is a type error rather than a silently empty map.
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
 * Records `entry` under `registry` on `proto`, keyed by its field name. The index is built here, once per field when
 * the class is defined, so a lookup on an instance hot path (an attribute change, a matched target token) is a single
 * `Map#get` rather than a scan. Registering the same key again replaces the earlier entry.
 *
 * Registrations live on the prototype that declared them and are not shared with a subclass, so a decorator can never
 * write into a superclass' map.
 */
export function register<T extends RegistryEntry>(proto: object, registry: Registry<T>, entry: T): void {
  let registries = ownRegistries<T>(proto);
  if (!registries) {
    registries = new Map();
    Object.defineProperty(proto, REGISTRIES, { value: registries, configurable: true });
  }

  let entries = registries.get(registry.name);
  if (!entries) {
    entries = new Map<string, T>();
    registries.set(registry.name, entries);
  }

  entries.set(entry.key, entry);
}

/**
 * The entries recorded under `registry` on `proto` by field name, in declaration order, or an empty map when nothing
 * was registered. Reading never allocates on the prototype, so asking about a class that declared nothing leaves it
 * untouched.
 *
 * The miss returns a fresh map rather than a shared empty one: `ReadonlyMap` is erased at runtime, so a single cast
 * on a shared instance would leak entries into every class that declared nothing.
 */
export function registered<T extends RegistryEntry>(proto: object, registry: Registry<T>): ReadonlyMap<string, T> {
  return ownRegistries<T>(proto)?.get(registry.name) ?? new Map<string, T>();
}

/**
 * The entries recorded under `registry` on the class of `instance` — {@link registered} for callers holding an
 * element rather than a prototype.
 *
 * Safe to call once from a field initializer and keep: an upgraded custom element has its prototype swapped inside
 * `super()`, before any field initializer runs, so construction already sees the class the element ended up as. The
 * map handed back is the prototype's own, so it is a reference to hold rather than a copy to rebuild.
 */
export function registeredFor<T extends RegistryEntry>(
  instance: object,
  registry: Registry<T>,
): ReadonlyMap<string, T> {
  return registered(Object.getPrototypeOf(instance), registry);
}

function ownRegistries<T extends RegistryEntry>(proto: object): Map<string, Map<string, T>> | undefined {
  if (!Object.hasOwn(proto, REGISTRIES)) return;
  return (proto as Record<symbol, Map<string, Map<string, T>>>)[REGISTRIES];
}
