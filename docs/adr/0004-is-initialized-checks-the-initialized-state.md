# `isInitialized` checks the Initialized state, not what `whenInitialized` waits for

`whenInitialized(element)` resolves once an element is ready to be interacted with. For a standard element that is
immediately, and for a non-Impulse custom element it is once its class is defined, although neither ever initializes.
`isInitialized(element)` could have mirrored that, so that it held exactly when `await whenInitialized(element)` would
not wait. Instead it returns `true` only for an Impulse element that is Initialized right now, and `false` for every
other element, so `isInitialized(div)` is `false` while `whenInitialized(div)` resolves at once.

The name is the glossary term, and the glossary says only an Impulse element can be Initialized. A `<div>` has no
properties, targets or actions to start, and `whenInitialized`'s own documentation says such elements never initialize.
A synchronous check for what `whenInitialized` waits for is a different concept. If it is ever needed, it deserves its
own name rather than a stretched meaning of Initialized. The caller that motivated the export checks
`isInitialized(this)` from inside an Impulse element, where the two meanings agree. A caller holding an arbitrary
element can still write `if (!isInitialized(element)) await whenInitialized(element)`, which works under either meaning.

## Considered Options

- **Mirroring `whenInitialized`.** Rejected for the reasons above. Flipping it later would change the answer for
  existing callers, so it was settled before the export shipped.
- **An instance getter, `this.initialized`.** Reads well inside an element, but with `useDefineForClassFields: false`
  a subclass field of the same name compiles to an assignment in the constructor, which throws on a getter-only
  accessor. `impulse_view_components` already declared `private initialized = false` in three elements, and an
  application subclass could too, so the getter would have been a breaking change. A free function also takes any
  element, such as a target typed as `Element`.
