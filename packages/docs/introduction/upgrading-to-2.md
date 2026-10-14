# Upgrading to 2.0

This page covers what you may need to change when moving from 1.x. See the
[changelog](https://github.com/Ambiki/impulse/blob/main/CHANGELOG.md) for the full list.

## Removed observer classes

`SelectorObserver`, `ElementObserver`, `AttributeObserver` and `TokenListObserver` are no longer exported. Use
[`connected`](/utilities/connected) and [`disconnected`](/utilities/disconnected) instead:

```ts
import { connected } from '@ambiki/impulse';

const stop = connected('[data-toggle="tooltip"]', (element) => {
  $(element).tooltip();
  return () => $(element).tooltip('dispose');
});
```

## `on` is delegated

[`on`](/utilities/on) now runs every handler from one listener on `document` instead of a listener on each matching
element.

- Events that do not bubble (`focus`, `blur`, `mouseenter`, `mouseleave`, `load`, `error`, `scroll`) need
  `{ capture: true }`, or use `focusin` / `focusout` / `mouseover` / `mouseout`.
- `event.currentTarget` is the matched element, as before.
- Without `capture`, `event.stopPropagation()` in an `on` handler stops other `on` handlers, but not native listeners
  on the elements between the target and `document`. A native listener that stops propagation keeps every bubbling
  `on` handler from running.

## Nothing matches before the document is parsed

`connected`, `disconnected` and `lazyImport` match nothing while `document.readyState` is `loading`. Called from a
blocking `<head>` script, their callbacks first run on `DOMContentLoaded`. On a long page, unenhanced content can show
briefly. See [before the document is parsed](/utilities/connected#before-the-document-is-parsed).

## Errors are reported, not thrown

A `connected`, `disconnected`, `lazyImport` or `[target]Connected()` / `[target]Disconnected()` callback that throws is
reported to `window.onerror` and no longer stops the other callbacks for the same DOM change. A duplicate `@target()` is
reported the same way instead of rejecting the element's initialization.

A selector the browser rejects throws a `DOMException` named `SyntaxError` at the call and registers nothing.

## The descendant wait is deprecated

Impulse still waits for undefined descendant custom elements before running `[target]Connected()` callbacks, but logs a
warning. If a callback reads a target's properties, await [`whenInitialized`](/utilities/when-initialized) instead, then
set `ImpulseElement.migratedToWhenInitialized = true`. See
[lifecycle callbacks](/reference/lifecycle-callbacks#target-connected).
