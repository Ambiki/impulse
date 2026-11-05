# isInitialized

The `isInitialized` function returns whether an Impulse element is initialized right now: its properties, targets, and
actions have started, and it has not been disconnected since. It is the synchronous counterpart of
[`whenInitialized`](/utilities/when-initialized), for when you need an answer now rather than a promise.

## Usage

A method on your element can be called at any time: right after the element is inserted, while it is still
initializing, or after it has been removed. Until it is initialized, its targets are not wired up. Check
`isInitialized(this)` and leave the work to `connected()`:

```ts{15-19}
import { ImpulseElement, isInitialized, property, registerElement, target } from '@ambiki/impulse';

@registerElement('modal-dialog')
export default class ModalDialogElement extends ImpulseElement {
  @property({ type: Boolean }) open = false;
  @target() dialog: HTMLDialogElement;

  connected() {
    if (this.open) {
      this.dialog.showModal();
    }
  }

  show() {
    if (!isInitialized(this)) {
      // Not wired up yet: `connected()` opens the dialog once it runs.
      this.open = true;
      return;
    }
    this.dialog.showModal();
  }
}
```

Pass the element to check, usually `this`.

## Inside lifecycle callbacks

An element counts as initialized from just before `connected()` runs until its teardown begins, just before
`disconnected()`:

| Called from                                               | `isInitialized(this)` |
| --------------------------------------------------------- | --------------------- |
| `[target]Connected()` while the element initializes       | `false`               |
| `connected()`                                             | `true`                |
| `[target]Connected()` for a target added later            | `true`                |
| `disconnected()`                                          | `false`               |
| `[target]Disconnected()` while the element is torn down   | `false`               |

## Elements that never initialize

Only an Impulse element can be initialized. `isInitialized` returns `false` for a standard HTML element and for a
non-Impulse custom element, even once [`whenInitialized`](/utilities/when-initialized) has resolved for them: it
resolves when there is nothing left to wait for, but they never initialize.

::: tip
An initialized Impulse element carries a `data-impulse-element` attribute, but the attribute reports the state rather
than conferring it. A `cloneNode` copy, or an element you wrote the attribute onto yourself, returns `false` until it
initializes. Check `isInitialized` rather than the attribute.
:::
