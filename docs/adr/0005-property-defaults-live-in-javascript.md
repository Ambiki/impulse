# Property Defaults live in JavaScript, not in attributes

An element used to write each `@property()` Default into its attribute when it connected, so a morph (a Turbo page
refresh, say) that synced it to server HTML without the attribute removed the Default until the next full page load.
We keep the Default in JavaScript instead, as Stimulus does for its values: connecting writes nothing, and a missing
attribute, or one that doesn't parse as its type, reads as the Default. The cost is that a connected element no longer
shows its Defaults, so `[placement="bottom"]` doesn't match unless the server renders the attribute.

A value assigned before the element connects is not a Default, so `registerElement` registers a subclass of the
decorated class that records each property's value once construction is done. Whatever differs from that record at
connect was assigned in between, and is written to the attribute like any assignment.

## Considered Options

- **Render every Default on the server** ([impulse_view_components#319](https://github.com/Ambiki/impulse_view_components/issues/319)).
  It fixes only the markup that does it, and defines each Default twice, in Ruby and in JavaScript, so a test has to
  keep them from drifting apart. The components may still render some, which this decision allows but no longer
  requires.
- **Take whatever a property holds at connect as its Default.** It needs no subclass, but a field initializer and a
  value assigned before connecting are both an own property by then. `impulse_view_components` sets `this.open = true`
  from `show()` on an element that hasn't connected yet. With `true` as the Default, `open` wrote no attribute, so
  `[open]` didn't match while it was open, and a later `hide()` wrote `open="false"`, which `[open]` does match. This
  is still what happens for a class registered with `customElements.define` rather than `registerElement`.
- **Write only the values that differ from the Default.** What lands in the DOM would then depend on a Default the
  reader can't see, so an assignment always writes its attribute instead.

## Consequences

The class registered for a tag name is a subclass of the one declared. With the decorator, the class name refers to
the subclass, but `registerElement(name)(Class)` registers only the class it returns, so `new Class()` throws.
