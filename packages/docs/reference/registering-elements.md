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
to register your class as a [custom element](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements).

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

## Re-registering

Defining the same tag name twice throws a `NotSupportedError` in the browser. Impulse swallows this specific error, so
importing the same element module more than once is safe and will not crash your app.
