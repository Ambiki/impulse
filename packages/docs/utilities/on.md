# on

The `on` function registers a delegated event listener that fires whenever an event reaches an element matching the
selector - including elements added to the DOM after `on` was called.

## Usage

A single document-level listener is shared across every `on(eventName, ...)` call with the same capture phase, so
registering many handlers does not multiply the number of native listeners. When the event fires, ancestors of
`event.target` are walked and `callback` is invoked once per matching ancestor with `event.currentTarget` set to the
matched element.

```ts
import { on } from '@ambiki/impulse';

// Listen for clicks on every button - including ones inserted later
on('click', 'button', (event) => {
  console.log('Button clicked: ', event.currentTarget);
});
```

## Event listener options

You can pass standard event listener [options](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#options):

```ts{4,9}
// Fire the event listener only once across the entire document
on('click', '.once-button', (event) => {
  console.log('Clicked once');
}, { once: true });

// Use capture phase
on('click', '.capture-host', (event) => {
  console.log('Captured');
}, { capture: true });
```

## Non-bubbling events

Because dispatch flows through a single document listener, events that do not bubble (`focus`, `blur`, `mouseenter`,
`mouseleave`, `load`, `error`, `scroll`) will not reach the listener unless you opt into the capture phase. Prefer the
bubbling counterparts (`focusin`, `focusout`, `mouseover`, `mouseout`) when possible:

```ts
// Both work, but the second avoids the capture-phase opt-in
on('focus', 'input', handler, { capture: true });
on('focusin', 'input', handler);
```

## Propagation

Calling `event.stopPropagation()` inside a handler halts further delegated dispatch on the same event - handlers
registered against ancestor selectors will not fire. `event.stopImmediatePropagation()` additionally blocks any
remaining handlers registered against the same element.

## Stopping observation

The `on` function returns a cleanup function that detaches the handler. The shared document listener is removed once
the last handler for that event name (and capture phase) is detached.

```ts{1,6}
const stop = on('click', 'button', (event) => {
  console.log('Clicked');
});

// Later, remove the handler
stop();
```
