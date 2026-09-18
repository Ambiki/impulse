# whenInitialized

The `whenInitialized` function returns a promise that resolves once an element is ready to be interacted with. For an
Impulse element that means once its properties, targets, and actions have started.

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
- **Impulse custom elements** resolve once they have initialized.
- **Non-Impulse custom elements** never initialize, so they resolve as soon as their class is defined
  (equivalent to `customElements.whenDefined`). This makes `whenInitialized` safe to use on any target element,
  whether or not it is an Impulse element.

::: tip
An initialized Impulse element carries a `data-impulse-element` attribute, but the attribute reports the state rather
than conferring it. An element that carries it without having initialized — a `cloneNode` copy, or an element you wrote
the attribute onto yourself — stays pending until it really initializes. How the element reached the DOM does not
matter: `innerHTML`, `appendChild`, and server-rendered markup all initialize normally.
:::

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

By default there is **no deadline** — like `customElements.whenDefined`, the promise stays pending until the element is
ready. A never-registered (e.g. mistyped) tag therefore never resolves, which surfaces as the code after your `await`
never running.

If you want to bail out after a while, pass a `timeout` (in milliseconds) and the promise rejects once it elapses. An
acceptable wait depends on your bundle size and your users' network — which only your application knows — so the library
does not pick one for you:

```ts
try {
  const panel = await whenInitialized(this.panelTarget, { timeout: 5000 });
} catch {
  // The element did not become ready in time.
}
```

::: tip
When awaiting a [lazily imported](/utilities/lazy-import) element, remember the wait includes fetching and executing its
JavaScript chunk. If you set a `timeout`, size it for your worst-case network, or omit it to wait indefinitely.
:::
