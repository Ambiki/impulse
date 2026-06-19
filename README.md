# Impulse

A lightweight JavaScript framework that leverages the Web Components API. Unlike traditional frameworks, Impulse doesn't
dictate how you render HTML. Instead, it's designed to augment your existing HTML with just the right amount of
JavaScript to make it interactive and reactive.

Write your HTML however you like, and let Impulse handle the behavior.

## Installation

```bash
yarn add @ambiki/impulse
```

## Example: Simple counter

```ts
import { ImpulseElement, property, registerElement, target } from '@ambiki/impulse';

@registerElement('counter-element')
export default class CounterElement extends ImpulseElement {
  @property({ type: Number }) count = 0;
  @target() output: HTMLElement;

  countChanged(newValue: number) {
    this.output.textContent = String(newValue);
  }

  decrement() {
    this.count--;
  }

  increment() {
    this.count++;
  }
}
```

HTML:

```html
<counter-element count="0">
  <h2>Count: <span data-target="counter-element.output">0</span></h2>
  <button data-action="click->counter-element#decrement">-</button>
  <button data-action="click->counter-element#increment">+</button>
</counter-element>
```

The counter automatically syncs the `count` attribute with the component property, calling `countChanged()` whenever it
updates. No virtual DOM, no JSX - just progressive enhancement of your HTML.

## Coming from Stimulus?

Impulse borrows Stimulus' best ideas, so actions, targets, and attribute-backed properties will feel familiar. The
difference is that components are native custom elements, which buys a few things:

- **Callable from anywhere.** A component _is_ its element, so its methods live on the DOM node - `document.querySelector('counter-element').increment()` works, even from existing jQuery code.
- **First-class TypeScript.** Properties and targets are declared with typed decorators.
- **A single shared DOM observer** for the whole app, rather than several per controller instance.

## Learn more

Check out the [full documentation](https://ambiki.github.io/impulse/) to explore more.

## License

This project is licensed under the terms of the [MIT License](https://opensource.org/license/mit/).
