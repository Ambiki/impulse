# Registering elements

Registering an element tells the browser to associate a tag name with your class. Use the `@registerElement()`
class decorator, passing the tag name you want to use in your HTML.

```ts{4}
// elements/clip_board_element.ts
import { ImpulseElement, registerElement } from '@ambiki/impulse';

@registerElement('clip-board')
export default class ClipBoardElement extends ImpulseElement {
  // ...
}
```

```html
<clip-board></clip-board>
```

Under the hood, this calls [`customElements.define()`](https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/define)
to register a [custom element](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements).
What it registers is a subclass of your class, which defines your [properties](/reference/properties) once the element
is constructed. With the decorator, the class name refers to that subclass, so `new ClipBoardElement()` and
`instanceof` work as usual. Called as a function, `registerElement('clip-board')(ClipBoardElement)`, it registers and
returns the subclass, so use what it returns. If the tag name is already defined, the call is ignored and the first
class stays registered.

## Tag names

The tag name must contain a hyphen — this is a requirement of the custom element spec, not Impulse. Names such as
`clipboard` or `popover` are invalid; use `clip-board` or `pop-over` instead.

The tag name is also the prefix you reference in [actions](/reference/actions) and [targets](/reference/targets):

```html
<clip-board>
  <input data-target="clip-board.input">
  <button data-action="click->clip-board#copy"></button>
</clip-board>
```

## Extending elements

An element class can extend another. It inherits every `@property()`, `@target()`, and `@targets()` of the classes it
extends, along with their methods, such as `[property]Changed()`:

```ts
class BaseInputElement extends ImpulseElement {
  @property({ type: Boolean }) disabled = false;
  @target() label: HTMLLabelElement | null;

  disabledChanged(disabled: boolean) {
    // ...
  }
}

@registerElement('fancy-input')
export default class FancyInputElement extends BaseInputElement {
  @property() placeholder = '';
}
```

`<fancy-input>` observes both `disabled` and `placeholder`, and fills `label`. Only the classes used as elements need
`@registerElement()`.

Declaring an inherited field again replaces its declaration, even with another decorator: a subclass can give a
`@property()` another type, or make it a `@target()`. The superclass keeps its own. A class can declare a field only
once, so `@property() @target() label` throws when the class is defined.

::: warning Declaring a field again without an initializer
With `useDefineForClassFields`, which TypeScript turns on for ES2022 and later targets and Babel uses by default, a
field declared again without an initializer starts out `undefined`, replacing the value the superclass gave it. A
`@property()` then reads its empty value when its attribute is missing. Repeat the initializer:

```ts
class SearchInputElement extends BaseInputElement {
  @property({ type: Boolean }) disabled = false;
}
```

To only narrow a field's type, without declaring it again, use `declare` instead (`declare label: HTMLLabelElement;`),
which compiles to nothing.
:::
