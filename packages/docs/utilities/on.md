# on

The `on` function sets up event listeners that automatically attach to elements matching a selector.

## Usage

This function observes the DOM and automatically adds event listeners to elements matching the provided CSS selector. Event listeners are added to existing elements immediately and to new elements as they're added to the DOM. When elements are removed or no longer match the selector, their event listeners are automatically cleaned up.

```ts
import { on } from '@ambiki/impulse';

// Listen for clicks on all buttons
on('click', 'button', (event, element) => {
  console.log('Button clicked: ', element);
});
```

## Event listener options

You can pass standard event listener [options](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#options) to customize the behavior:

```ts
// Fire the event listener only once
on('click', '.once-button', (event, element) => {
  console.log('Clicked once');
}, { once: true });

// Use capture phase
on('focus', 'input', (event, element) => {
  console.log('Input focused');
}, { capture: true });

// Mark as passive for better scroll performance
on('touchstart', '.slider', (event, element) => {
  handleTouch(event);
}, { passive: true });
```

## Stopping observation

The `on` function returns a cleanup function that removes all event listeners and stops observing when called.

```ts
const stop = on('click', 'button', (event, element) => {
  console.log('Clicked');
});

// Later, remove all listeners and stop observing
stop();
```
