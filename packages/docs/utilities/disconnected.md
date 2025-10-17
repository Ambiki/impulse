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

## Stopping observation

The `disconnected` function returns a cleanup function that stops observing when called.

```ts
const stop = disconnected('div', (element) => {
  console.log('Disconnected');
});

// Later, stop observing
stop();
```
