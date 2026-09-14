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
