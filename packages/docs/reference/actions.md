# Actions

Actions let you bind event listeners to an element.

## Attributes and names

The `data-action` attribute is a space-separated list of action [descriptors](#descriptors) that defines how an element
should react when an event is fired on it.

```html{2}
<greet-user>
  <button type="button" data-action="click->greet-user#greet">...</button>
</greet-user>
```

```ts{6}
// elements/greet_user_element.ts
import { ImpulseElement, registerElement } from 'impulse';

@registerElement('greet-user')
export default class GreetUserElement extends ImpulseElement {
  greet(event: Event) {
    //
  }
}
```

## Descriptors

The `data-action` value `click->greet-user#greet` is called an action descriptor. In this descriptor:
- `click` is the name of the DOM event.
- `greet-user` is the name of the custom element.
- `greet` is the name of the function that should be invoked when the event is triggered.

## Global events

You can add `@window` or `@document` to the descriptor to listen for events on the `window` or `document` respectively.

```html
<!-- Listen for the `resize` event on the `window`. -->
<div data-action="resize@window->image-gallery#resizeLayout"></div>

<!-- Listen for the `mouseup` event on the `document`. -->
<div data-action="mouseup@document->my-element#invokeAction"></div>
```

## Event modifiers

It is very common to call `event.preventDefault()` or `event.stopPropagation()` inside event handlers. Although you
can do this inside the function, it would be better if it is explicitly mentioned in the action descriptor.

To address this, Impulse provides these modifiers out of the box.

- `.stop`
- `.prevent`
- `.self`
- `.capture`
- `.once`
- `.passive`

```html
<!-- Calls the `.stopPropagation()` on the event. -->
<button data-action="click.stop->my-element#invokeAction"></button>

<!-- Calls the `.preventDefault()` on the event. -->
<form data-action="click.prevent->my-element#invokeAction"></form>

<!-- Only call the function if event.target is the element itself. -->
<div data-action="click.self->my-element#invokeAction"></div>

<!-- Modifiers can be chained. -->
<a href="#" data-action="click.stop.prevent->my-element#invokeAction"></a>
```

The `.capture`, `.once`, and `.passive` modifiers mirror the [DOM event listener options](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#options).

```html
<div data-action="click.capture->my-element#invokeAction"></div>
<div data-action="click.once->my-element#invokeAction"></div>
<div data-action="scroll.passive->my-element#invokeAction"></div>
```

## Naming conventions

Always use camelCase to reference the action names.

```html
<div data-action="click->greet-user#doThis"></div>
<div data-action="click->greet-user#avoid_this"></div>
```
