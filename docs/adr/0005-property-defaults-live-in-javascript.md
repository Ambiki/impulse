# Property Defaults live in JavaScript, not in attributes

An element used to write each `@property()` Default into its attribute when it connected, so a morph (a Turbo page
refresh, say) that synced it to server HTML without the attribute removed the Default until the next full page load.
We keep the Default in JavaScript instead, as Stimulus does for its values: connecting writes nothing, and a missing
attribute, or one that doesn't parse as its type, reads as the Default. The cost is that a connected element no longer
shows its Defaults, so `[placement="bottom"]` doesn't match unless the server renders the attribute.

## Considered Options

- **Render every Default on the server.** It fixes only the markup that does it, and defines each Default twice, in
  Ruby and in JavaScript, so a test has to keep them from drifting apart. `impulse_view_components` may still render
  some, which this decision allows but no longer requires.
- **Capture Defaults in `registerElement`.** A field initializer and a value assigned before the element connects are
  both an own property when the element connects, so the latter becomes the Default rather than being written.
  Telling them apart would mean `registerElement` returning a subclass that records the field values at the end of
  construction. The class registered for a tag name would then not be the class the module exports, which breaks
  `registerElement(name)(Class)` followed by `new Class()`.
- **Write only the values that differ from the Default.** What lands in the DOM would then depend on a Default the
  reader can't see, so an assignment always writes its attribute instead.
