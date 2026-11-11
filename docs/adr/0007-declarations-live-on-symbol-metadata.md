# Declarations live on the class's `Symbol.metadata`, in both decorator conventions

A standard (TC39) field decorator never sees the prototype, only a `context` whose `metadata` is a per-class object
created as `Object.create(superclass[Symbol.metadata] ?? null)`. So that standard decorators can record Declarations, we
store every Declaration on the class's `Symbol.metadata`, and the legacy decorators write there too: given the
prototype, a legacy decorator creates the class's own metadata object the same way the standard emitters do. Every read
goes through one path, and a subclass inherits its superclass's Declarations through the metadata chain whichever
convention compiled either class.

Impulse polyfills `Symbol.metadata` with `Symbol.for('Symbol.metadata')` when the module loads, and reads it at call
time. tsc only creates `context.metadata` when `Symbol.metadata` exists, and esbuild and Babel fall back to
`Symbol.for('Symbol.metadata')` without it, so the registered symbol makes all three agree. A polyfill that runs first,
such as Lit's `Symbol('metadata')`, is kept, and every emitter uses it.

## Considered Options

- **Two stores: the prototype for legacy, `context.metadata` for standard, unioned at every read.** It leaves legacy
  untouched, but each read site has to merge two sources, inheritance needs a prototype-chain walk as well as the
  metadata chain, and a standard subclass of a legacy base (one from a library, say) would not see the base's
  Declarations.
- **No polyfill, documented as a user requirement.** A tsc project on its default settings that misses the step gets
  `context.metadata === undefined` and registers nothing, silently. A field decorator has no other way to reach its
  class before `customElements.define` reads `observedAttributes`: `context.addInitializer` runs per instance.

## Consequences

A legacy-compiled class gets an own `Symbol.metadata` property it didn't have before, the same one a standard-compiled
class carries. Impulse mutates a global when it loads.

A standard `@registerElement` defines the element from a class `context.addInitializer`, which runs once the class is
complete and its metadata attached, rather than from the decorator body, where `Symbol.metadata` would still resolve to
the superclass's and the class's static fields would not be set yet. The subclass that `registerElement` registers (see
[ADR 0005](0005-property-defaults-live-in-javascript.md)) needs no shared registrations: it reads the decorated class's
Declarations through the metadata chain.
