# Property Defaults live in JavaScript, not in attributes

An element used to write each `@property()` Default into its attribute when it connected, as Catalyst's `@attr` does.
From then on the attribute was the only place the Default lived. Server HTML that relies on a Default doesn't carry the
attribute, so a morph (a Turbo page refresh, say) removed it, and the property read its Empty value instead until the
next full page load. We now keep the Default in JavaScript, as Stimulus does for its values: connecting writes nothing,
and a missing attribute, or one that doesn't parse as its type, reads as the Default. A morph then has nothing to strip.

The cost is that a connected element no longer shows its Defaults. `getAttribute()` returns `null` for them, and CSS
such as `[placement="bottom"]` doesn't match unless the server renders the attribute.

## Considered Options

- **Render every Default on the server.** It fixes only the markup that does it, and defines each Default twice, in
  Ruby and in JavaScript, so a test has to keep them from drifting apart. `impulse_view_components` may still render
  some, which this decision allows but no longer requires.
- **Capture Defaults in `registerElement`.** A Default and a value assigned before the element connects are both an
  own property when the element connects, so the latter becomes the Default rather than being written. Telling them
  apart would mean `registerElement` returning a subclass that records the field values at the end of construction.
  The class registered for a tag name would then not be the class the module exports, which breaks
  `registerElement(name)(Class)` followed by `new Class()`, and it would cover a case nothing was found relying on.
- **Write only the values that differ from the Default.** An assignment always writes its attribute instead, so
  what lands in the DOM doesn't depend on a Default the reader can't see. The exception is a `Boolean` set to `false`:
  it removes the attribute, unless its Default is `true`, in which case `"false"` is written so it can still be turned
  off.
