# emit

The `emit` function dispatches a custom event from a specified target element.

## Usage

This function creates and dispatches a [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent) with
typed detail data. Events are created with `bubbles: true` and `composed: true` by default, allowing them to propagate
through the DOM and cross shadow DOM boundaries.

```ts{5}
import { emit } from '@ambiki/impulse';

// Dispatch a simple custom event
const button = document.querySelector('button');
emit(button, 'custom-click', { detail: { count: 1 } });
```

## Event detail data

You can include custom data in the event's detail property:

```ts{3-6}
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

```ts{4,10,16}
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

The function returns the [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent) that was
dispatched, allowing you to inspect its state:

```ts
const event = emit(element, 'my-event', { detail: { success: true } });
console.log(event.defaultPrevented);
```

## Emitting from an element

Every Impulse element has an `emit()` method that dispatches from itself and prefixes the event name with the
element's tag name, so listeners can tell your events apart from everyone else's.

```ts{10}
import { ImpulseElement, registerElement, target } from '@ambiki/impulse';

@registerElement('clip-board')
export default class ClipBoardElement extends ImpulseElement {
  @target() input: HTMLInputElement;

  copy() {
    navigator.clipboard.writeText(this.input.value);
    // Dispatches `clip-board:copied` from `<clip-board>`.
    this.emit('copied', { detail: { value: this.input.value } });
  }
}
```

```ts
document.querySelector('clip-board').addEventListener('clip-board:copied', (event) => {
  console.log(event.detail.value);
});
```

It accepts the same options as the standalone function, plus two of its own:

- `prefix` — the prefix to use. Defaults to the element's tag name. Pass a string to use a different one, or `false`
  to dispatch the bare event name.
- `target` — what to dispatch from. Defaults to the element itself.

```ts
// Dispatches `copied`.
this.emit('copied', { prefix: false });

// Dispatches `clipboard:copied`.
this.emit('copied', { prefix: 'clipboard' });

// Dispatches `clip-board:copied` from the `document`.
this.emit('copied', { target: document });
```

Like the standalone function, it returns the dispatched `CustomEvent`.
