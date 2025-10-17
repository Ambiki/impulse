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
