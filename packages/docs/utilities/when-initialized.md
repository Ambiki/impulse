# whenInitialized

The `whenInitialized` function returns a promise that resolves once an element is ready to be interacted with. For an
Impulse element that means once its properties, targets, and actions have started.

This mirrors the familiar [`customElements.whenDefined()`](https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/whenDefined)
pattern, but for an Impulse element resolves on full initialization rather than mere definition.

## Usage

```ts
import { whenInitialized } from '@ambiki/impulse';

// Inside an Impulse element declaring `@target() select: SelectElement;`
const select = await whenInitialized(this.select);
select.doSomething();
```

Pass an element, not `null`. A `@target()` with no matching element is `null`, and `whenInitialized(null)` throws a
`TypeError`.

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

When a `[target]Connected()` callback fires, the target element is in the DOM but may not have finished initializing
yet. Its `@property` accessors exist once its class is defined, but a target whose class is not defined yet (one loaded
with [`lazyImport`](/utilities/lazy-import), for example) has none. If you need to read a target's properties, await
`whenInitialized` first:

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
never running. Neither does an Impulse element that is not in the DOM: disconnecting one resets it, so it stays pending
until it is connected and initializes again.

If you want to bail out after a while, pass a `timeout` (in milliseconds) and the promise rejects once it elapses. An
acceptable wait depends on your bundle size and your users' network — which only your application knows — so the library
does not pick one for you:

```ts
try {
  const panel = await whenInitialized(this.panel, { timeout: 5000 });
} catch {
  // The element did not become ready in time.
}
```

The rejection is an `Error` reading `<my-panel> was not initialized within 5000ms.` A `timeout` of `Infinity` means no
deadline.

::: tip
When awaiting a [lazily imported](/utilities/lazy-import) element, remember the wait includes fetching and executing its
JavaScript chunk. If you set a `timeout`, size it for your worst-case network, or omit it to wait indefinitely.
:::
