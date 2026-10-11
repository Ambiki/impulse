# lazyImport

Lazy import helps improve the initial loading performance of an application by loading modules only when elements
matching a selector are present in the DOM.

For example, you might want to load a dialog element only when the dialog is used on the page, or you might want to
load CAPTCHA only on registration pages.

## Examples

By using the `lazyImport` function, the dialog element will not be included in the apps' initial bundle. The first
argument is the CSS selector, and the second argument is the import function that should be invoked when the selector
is present on the page.

```ts
import { lazyImport } from '@ambiki/impulse';

// Looks for `<my-dialog>` element
lazyImport('my-dialog', () => import('../components/dialog'));

// Looks for an element with an ID of `registration-form`
lazyImport('#registration-form', () => import('../utils/registration-utils'));

// Looks for an element with the class `billing`
lazyImport('.billing', () => import('../components/billing'));
```

## Inside the imported module

The import callback runs once per selector, the first time a matching element is seen. The module it loads should not
look the element up with `document.querySelector`: the import resolves asynchronously, so the element may already be
gone by then, and any matching element added later (for example after a Turbo navigation) would be missed. Register
with [`connected`](./connected) instead so the module sees every matching element, now and in the future.

```ts
// components/billing.ts
import { connected } from '@ambiki/impulse';

connected('.billing', (element) => {
  // Runs for the element that triggered the import and for every `.billing` element added afterwards.
});
```

## Performance

Prefer self-contained selectors: see [Performance](./connected#performance) under `connected`.
