# A property's Type reads, writes, and compares its values, in one object

`@property({ type })` takes one of the five built-in constructors or a Type an author defines: an object with
`fromAttribute` and `toAttribute`, and optionally `isEqual` and `emptyValue`. The built-ins are defined through the same
interface. The comparison that decides whether `[property]Changed` fires lives in the Type, beside the parse, because
the attribute is the source of truth: every read parses a fresh value, so how two values compare follows from how they
were parsed. When `Array` and `Object` compared by reference, their callbacks fired on every rewrite of the attribute
([#180](https://github.com/Ambiki/impulse/issues/180)). A Type that leaves out `isEqual` takes two values as the same
when they write the same attribute. That is right for any Type: two values that write the same attribute can't be told
apart through it, and a Type that doesn't write canonically (a Set in insertion order) costs an extra callback, never a
missed one.

A Type never sees "nothing". A missing attribute reads as the Default without asking the Type, and a `fromAttribute`
that returns `null` or `undefined` means the attribute doesn't parse, so the property reads the Default too. Assigning
`null` or `undefined` removes the attribute without asking the Type, and Impulse compares a `null` value itself.

## Considered Options

- **Lit's split: a `converter` beside `type`, which it receives as a hint, and a separate `hasChanged`.** Familiar to
  Lit users, but it is two options for one idea whose meaning depends on the other, and `hasChanged` defaults to `!==`,
  so every converter of an object type is one forgotten option away from #180.
- **A `converter` option that can't be combined with `type`.** Lit's name without the hint, but still two keys for one
  idea, and the combination is caught by an overload and a runtime check instead of being impossible to write.
- **`isEqual` defaulting to `Object.is`.** Wrong for every Type whose values are objects, such as a Date.
- **A required `isEqual`.** Correct, but boilerplate in every Type when comparing what two values write is already
  correct.

## Consequences

Lit's `converter` is `type` here, and its `hasChanged` is the Type's `isEqual`.

A Type has no `copy`. A missing attribute reads as the Default sent through `toAttribute` and back through
`fromAttribute`, or as the Default itself when that gives nothing, so it reads exactly as an attribute holding the
Default would, and mutating what the getter returns never reaches the Default. For the built-ins this changes only a
Default of the wrong type: `@property() count = 5` reads `"5"`, as a `String` would parse it.
