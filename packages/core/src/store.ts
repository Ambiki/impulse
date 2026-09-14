import type { PropertyType } from './decorators/property';
import type { TargetType } from './decorators/target';

const REGISTRY = Symbol.for('impulse');

declare const entryType: unique symbol;

/**
 * A named collection of class-level registrations, held on the prototype the decorator ran against. The token carries
 * the entry type, so a registry can only ever be written and read with matching values: passing {@link TARGETS} where
 * {@link PropertyType} entries are expected is a type error rather than a silently empty set.
 */
export interface Registry<T extends object> {
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
export const PROPERTIES: Registry<PropertyType> = { name: 'property' };

/**
 * Fields declared with `@target()` / `@targets()`, read back by `Target`.
 */
export const TARGETS: Registry<TargetType> = { name: 'target' };

/**
 * Records `entry` under `registry` on `proto`.
 *
 * Registrations live on the prototype that declared them and are not shared with a subclass, so a decorator can never
 * write into a superclass' set.
 */
export function register<T extends object>(proto: object, registry: Registry<T>, entry: T): void {
  let registries = ownRegistries<T>(proto);
  if (!registries) {
    registries = new Map();
    Object.defineProperty(proto, REGISTRY, { value: registries, configurable: true });
  }

  let entries = registries.get(registry.name);
  if (!entries) {
    entries = new Set<T>();
    registries.set(registry.name, entries);
  }

  entries.add(entry);
}

/**
 * The entries recorded under `registry` on `proto`, or an empty set when nothing was registered. Reading never
 * allocates on the prototype, so asking about a class that declared nothing leaves it untouched.
 *
 * The miss returns a fresh set rather than a shared empty one: `ReadonlySet` is erased at runtime, so a single cast
 * on a shared instance would leak entries into every class that declared nothing.
 */
export function registered<T extends object>(proto: object, registry: Registry<T>): ReadonlySet<T> {
  return ownRegistries<T>(proto)?.get(registry.name) ?? new Set<T>();
}

/**
 * The entries recorded under `registry` on the class of `instance` — {@link registered} for callers holding an
 * element rather than a prototype.
 *
 * The prototype is resolved on every read rather than cached at construction, so an instance upgraded after its
 * helpers were built still reads the registrations of the class it ended up as.
 */
export function registeredFor<T extends object>(instance: object, registry: Registry<T>): ReadonlySet<T> {
  return registered(Object.getPrototypeOf(instance), registry);
}

function ownRegistries<T extends object>(proto: object): Map<string, Set<T>> | undefined {
  if (!Object.hasOwn(proto, REGISTRY)) return;
  return (proto as Record<symbol, Map<string, Set<T>>>)[REGISTRY];
}
