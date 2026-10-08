# disconnected

The `disconnected` function allows you to observe the DOM and invoke a callback whenever elements matching a selector are removed from the DOM.

## Usage

This function sets up a [MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) on the
document that watches for elements matching the provided CSS selector being disconnected. The callback is invoked when
matching elements are removed from the DOM or when their attributes change such that they no longer match the selector.

```ts
import { disconnected } from '@ambiki/impulse';

// Watch for buttons being removed from the DOM
disconnected('button', (element) => {
  console.log('Button disconnected: ', element);
});
```

Like `connected`, it matches nothing [before the document is parsed](./connected#before-the-document-is-parsed), so an
element inserted and removed while `document.readyState` is `loading` is never reported. A callback that throws is
[reported like an uncaught error](./connected#errors).

## Stopping observation

The `disconnected` function returns a cleanup function that stops observing when called.

```ts{1,6}
const stop = disconnected('div', (element) => {
  console.log('Disconnected');
});

// Later, stop observing
stop();
```

## Performance

Prefer self-contained selectors: see [Performance](./connected#performance) under `connected`.
