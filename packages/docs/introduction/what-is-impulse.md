# What is Impulse?

Impulse is a lightweight JavaScript framework built on the [Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components)
API. Unlike traditional frameworks, it does not dictate how you render HTML. Instead, it augments your existing HTML
with just enough JavaScript to make it interactive and reactive.

Write your HTML however you like — server-rendered, static, or generated — and let Impulse handle the behavior.

## Mental model

Impulse leans on progressive enhancement. There is no virtual DOM and no JSX. You write a [custom element](/reference/registering-elements)
around your markup, then wire up behavior with a small set of building blocks:

- [**Actions**](/reference/actions) bind event listeners declaratively via `data-action` attributes.
- [**Targets**](/reference/targets) reference child elements by name via `data-target` attributes.
- [**Properties**](/reference/properties) read and write HTML attributes, with change callbacks.
- [**Lifecycle callbacks**](/reference/lifecycle-callbacks) run code when an element or target connects to or disconnects from the DOM.

## Example

This counter keeps the `count` attribute in sync with the component's property, calling `countChanged()` whenever it
updates:

```ts
import { ImpulseElement, property, registerElement, target } from '@ambiki/impulse';

@registerElement('counter-element')
export default class CounterElement extends ImpulseElement {
  @property({ type: Number }) count = 0;
  @target() output: HTMLElement;

  countChanged(value: number) {
    this.output.textContent = String(value);
  }

  decrement() {
    this.count--;
  }

  increment() {
    this.count++;
  }
}
```

```html
<counter-element count="0">
  <h2>Count: <span data-target="counter-element.output">0</span></h2>
  <button data-action="click->counter-element#decrement">-</button>
  <button data-action="click->counter-element#increment">+</button>
</counter-element>
```

No virtual DOM, no JSX — just progressive enhancement of your HTML.

## Coming from Stimulus?

If this looks like [Stimulus](https://stimulus.hotwired.dev/), that's no accident — Impulse borrows its best ideas, so
actions, targets, and attribute-backed properties will feel familiar. Stimulus is mature and battle-tested, and it
remains a great choice. Impulse makes a different set of trade-offs that grew out of building [Ambiki](https://www.ambiki.com):

- **Components are native custom elements.** A component _is_ its element (`<counter-element>`), so its methods live
  on the DOM node — you can call them from anywhere, including existing jQuery code:
  `document.querySelector('counter-element').increment()`. With Stimulus, the controller instance is not exposed on the
  element, so reaching it from outside the framework is awkward.
- **First-class TypeScript.** Properties and targets are declared with typed decorators
  (`@property({ type: Number }) count`, `@target() output: HTMLElement`) rather than stringly-typed statics.
- **A single shared DOM observer.** Impulse watches the document with one shared
  [MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver), regardless of how many elements
  are on the page. Stimulus instantiates several observers per controller instance, which added up on the dense,
  long-lived pages we were building.
