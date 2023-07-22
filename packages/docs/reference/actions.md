# Actions

Actions let you bind events to an element.

## Attributes and names

The `data-action` attribute is a space-separated list of action descriptors.

```html
<greet-user>
  <button type="button" data-action="click->greet-user#greet">...</button>
</greet-user>
```

```ts
// elements/greet_user_element.ts
import { ImpulseElement, registerElement } from 'impulse';

@registerElement('greet-user')
export default class GreetUserElement extends ImpulseElement {
  greet(event) {
    //
  }
}
```

## Descriptors

The `data-action` value `click->greet-user#greet` is called an action descriptor. In this descriptor:
- `click` is the name of the DOM event.
- `greet-user` is the name of the element.
- `greet` is the name of the function that should be invoked.

## Global events

You can add `@window` or `@document` to the descriptor to listen for events on the `window` or `document` respectively.

```html
<image-gallery data-action="resize@window->image-gallery#resize-layout">
</image-gallery>
```

## Multiple actions

In the below example, the `greet-user` element's `highlight` function is called when the input element receives focus,
and `search-user` element's `search` function is called when the input element's value changes.

```html
<input type="text" data-action="focus->greet-user#highlight input->search-user#search">
```

## Naming conventions

Always use camelCase to reference the action names.

```html
<div data-action="click->greet-user#doThis"></div>
<div data-action="click->greet-user#avoid-this"></div>
```
