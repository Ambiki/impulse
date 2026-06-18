# whenInitialized

The `whenInitialized` function returns a promise that resolves once an element is ready to be interacted with. For an
Impulse element that means once its properties, targets, and actions have started and the `data-impulse-element` marker
attribute has been set.

This mirrors the familiar [`customElements.whenDefined()`](https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/whenDefined)
pattern, but for an Impulse element resolves on full initialization rather than mere definition.

## Usage

```ts
import { whenInitialized } from '@ambiki/impulse';

const select = await whenInitialized(this.selectTarget);
select.doSomething();
```

- **Standard HTML elements** (a tag name without a hyphen can never be a custom element) resolve immediately — there is
  nothing to initialize.
- **Impulse custom elements** resolve once the marker attribute is set.
- **Non-Impulse custom elements** never receive the marker, so they resolve as soon as their class is defined
  (equivalent to `customElements.whenDefined`). This makes `whenInitialized` safe to use on any target element,
  whether or not it is an Impulse element.
- If none of the above happens within `timeout` milliseconds the promise rejects, so a mistyped or never-registered
  element surfaces an error instead of hanging forever.

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
