# emit

The `emit` function dispatches a custom event from a specified target element.

## Usage

This function creates and dispatches [CustomEvents](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent) with
typed detail data. Events are created with `bubbles: true` and `composed: true` by default, allowing them to propagate
through the DOM and cross shadow DOM boundaries.

```ts
import { emit } from '@ambiki/impulse';

// Dispatch a simple custom event
const button = document.querySelector('button');
emit(button, 'custom-click', { detail: { count: 1 } });
```

## Event detail data

You can include custom data in the event's detail property:

```ts
const button = document.querySelector('button');
emit(button, 'custom-click', {
  detail: {
    username: 'john',
    email: 'john@example.com',
  },
});
```

## Event options

You can customize the event behavior by passing additional [options](https://developer.mozilla.org/en-US/docs/Web/API/Event/Event#options):

```ts
// Dispatch without bubbling
emit(element, 'local-event', {
  detail: { message: 'Hello' },
  bubbles: false,
});

// Prevent the event from crossing shadow DOM boundaries
emit(element, 'internal-event', {
  detail: { value: 42 },
  composed: false,
});

// Make the event cancelable
emit(element, 'cancelable-event', {
  detail: { data: 'test' },
  cancelable: true,
});
```

## Return value

The function returns the [CustomEvents](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent) that was
dispatched, allowing you to inspect its state:

```ts
const event = emit(element, 'my-event', { detail: { success: true } });
console.log(event.defaultPrevented);
```
