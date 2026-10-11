# connected

The `connected` function allows you to observe the DOM and invoke a callback whenever elements matching a selector are added to the DOM.

## Usage

This function sets up a [MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) on the
document that watches for elements matching the provided CSS selector. The callback is invoked immediately for any
matching elements already in the DOM, then for any elements added later, and for any element whose attributes change
such that it starts matching the selector.

This is particularly useful for initializing third-party libraries that require a manual initialization step on a given
element.

This example initializes Bootstrap's [tooltip](https://getbootstrap.com/docs/4.6/components/tooltips/#tooltipoptions)
library on any element matching the selector.

```ts
import { connected } from '@ambiki/impulse';

connected('[data-toggle="tooltip"]', (element) => {
  $(element).tooltip();
  // Destroy the tooltip instance when the element is removed from the page.
  return () => {
    $(element).tooltip('dispose');
  };
});
```

## Cleanup

The callback can optionally return a cleanup function that will be called when the element is disconnected from the DOM. This is useful for removing event listeners or clearing timers.

```ts{4-6}
connected('.dynamic-content', (element) => {
  console.log('Element connected: ', element);

  return () => {
    console.log('Element disconnected: ', element);
  };
});
```

## Stopping observation

The `connected` function returns a cleanup function that stops observing when called. Any element still in the DOM at that point has its cleanup function run immediately, since it will never be disconnected through this watcher.

```ts{1,6}
const stop = connected('div', (element) => {
  console.log('Connected');
});

// Later, stop observing
stop();
```

## Performance

Impulse watches the whole document with one `MutationObserver`, shared by every selector you register. That sharing has
a catch: the most expensive selector sets the price for all of them. One costly selector — in your own code, or in a
library you installed — slows down every other watcher on the page.

Two separate things decide what a selector costs.

### What Impulse has to listen to

Impulse wants to hear about an attribute change only when it could make an element start or stop matching. It can work
out which attributes those are when the selector describes **one element**: a tag name, `#id`, `.class`, an attribute
selector such as `[data-toggle]`, or `:is()`, `:where()` and `:not()` over those. Such a selector is *self-contained*
— nothing outside the element itself can change whether it matches.

```ts
connected('[data-toggle="tooltip"]', setUpTooltip); // only `data-toggle` changes arrive
connected('button.primary', setUpButton); // only `class` changes arrive
```

Add a combinator or any other pseudo-class and that goes away:

```ts
connected('.toolbar [data-toggle="tooltip"]', setUpTooltip);
connected('input:disabled', setUpDisabledInput);
```

Now whether an element matches depends on something that is not the element — an ancestor, a sibling, a user-interface
state. Impulse cannot name the attributes that matter, so it stops filtering and takes **every attribute change in the
document**: a `style` written on each animation frame, a class toggled on a menu, an `aria-expanded` flipped in a
dialog. All of it arrives, for as long as that one selector stays registered.

A selector containing an escape sequence or a comment has the same effect, since Impulse does not try to read those.

### How Impulse finds elements in a changed subtree

When a subtree is added or removed, Impulse asks the browser for the elements it cares about rather than looking at
each one in turn. Adding is straightforward: it queries your selectors as written.

Removing is harder, because a removed subtree is already detached — an ancestor the selector names is no longer there
to match. So Impulse queries each selector's **subject** instead: the rightmost part, the bit describing the element
itself. `.toolbar a` becomes `a`, and `.open .item:hover` becomes `.item`. Everything the full selector matched still
matches that, which is all a removal needs to find.

This only breaks down when the subject names nothing to search for:

```ts
connected('.open *', setUpAnything);
connected(':is(a, button)', setUpControl);
```

There is no tag, id, class, or attribute to hand the browser, so Impulse falls back to visiting every element in the
removed subtree. Escapes and comments, again, do the same.

### The two costs do not line up

| Selector             | Attribute changes delivered | Removing a subtree       |
| -------------------- | --------------------------- | ------------------------ |
| `[data-toggle]`      | only `data-toggle`          | queries `[data-toggle]`  |
| `button.primary`     | only `class`                | queries `button.primary` |
| `.toolbar a`         | **all of them**             | queries `a`              |
| `input:disabled`     | **all of them**             | queries `input`          |
| `:is(a, button)`     | none needed                 | **visits every element** |
| `.open *`            | **all of them**             | **visits every element** |

`.toolbar a` is cheap to find but expensive to listen for. `:is(a, button)` is the other way round. Every one of them
matches exactly the elements it always did — only the cost differs.

### Keeping a selector cheap

Move the part of the selector that is about *other* elements into the callback. What you register stays
self-contained, and the narrowing still happens.

```ts [Bad]
// A combinator, so every attribute change in the document reaches Impulse.
connected('.toolbar [data-toggle="tooltip"]', (element) => {
  $(element).tooltip();
});
```

```ts [Good]
// Self-contained, so only `data-toggle` changes reach Impulse.
connected('[data-toggle="tooltip"]', (element) => {
  if (!element.closest('.toolbar')) return;
  $(element).tooltip();
});
```

You give up less than it looks. The first version does not react to `.toolbar` appearing on an ancestor either: Impulse
re-checks the element a change was reported for, never that element's descendants. It would notice only by accident, if
some unrelated attribute happened to change on the tooltip afterwards. The second just does not tax the rest of the
page for it.

The same applies to [`disconnected`](./disconnected) and [`lazyImport`](./lazy-import).
