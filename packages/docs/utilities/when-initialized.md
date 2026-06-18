# whenInitialized

The `whenInitialized` function returns a promise that resolves once an element has been fully initialized by Impulse —
that is, once its properties, targets, and actions have started and the `data-impulse-element` marker attribute has been
set.

This mirrors the familiar [`customElements.whenDefined()`](https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/whenDefined)
pattern, but resolves on full initialization rather than mere definition.

## Usage

```ts
import { whenInitialized } from '@ambiki/impulse';

const select = await whenInitialized(this.selectTarget);
select.doSomething();
```

- **Standard HTML elements** (a tag name without a hyphen can never be a custom element) resolve immediately — there is
  nothing to initialize.
- **Custom elements** resolve once the marker attribute is set. If that does not happen within `timeout` milliseconds the
  promise rejects, so a mistyped or non-Impulse element surfaces an error instead of hanging forever.

## Reading a target's properties from a connected callback

When a `[target]Connected()` callback fires, the target element is in the DOM but may not have finished initializing yet,
so its `@property` accessors may not be installed. If you need to read a target's properties, await `whenInitialized`
first:

```ts
@target() select: SelectElement;

async selectConnected(select: SelectElement) {
  await whenInitialized(select);
  console.log(select.value); // safe to read Impulse properties now
}
```

## Timeout

The default timeout is `3000` milliseconds. Pass a custom `timeout` to override it:

```ts
await whenInitialized(this.selectTarget, { timeout: 5000 });
```
