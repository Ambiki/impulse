# Clipboard element

In this tutorial, we will build a simple clipboard element to get familiar with Impulse elements.

## Start with HTML

To build a clipboard element, we will need an input and a button element. When a user clicks on the button element, we
want to copy the value of the input element into their clipboard.

```html
<div>
  <input type="text" value="Copy this value!" readonly>
  <button type="button">Copy</button>
</div>
```

## The Impulse element

Create a new file named `clip_board_element.ts` and let's extend the framework's built-in `ImpulseElement` class.

```ts
// clip_board_element.ts
import { ImpulseElement } from 'impulse';

export default class ClipBoardElement extends ImpulseElement {
}
```

## Linking the element with the DOM

Next, we need to tell Impulse how this element should be linked to the DOM. To do this, first, we will register the
element.

```ts{4}
// clip_board_element.ts
import { ImpulseElement, registerElement } from 'impulse';

@registerElement('clip-board') // This will be the tag name of our element.
export default class ClipBoardElement extends ImpulseElement {
}
```

Secondly, we will replace our `<div>` with the `<clip-board>` tag.

```html{1,4}
<clip-board>
  <input type="text" value="Copy this value!" readonly>
  <button type="button">Copy</button>
</clip-board>
```

## Binding actions and responding to it

```ts{6-8}
// clip_board_element.ts
import { ImpulseElement, registerElement } from 'impulse';

@registerElement('clip-board')
export default class ClipBoardElement extends ImpulseElement {
  copy() {
    console.log('copy triggered!');
  }
}
```

We want to call the `copy` function when the button is clicked. You can do this by binding `button.addEventListener('click', this.copy)`
in the `connected` [hook](/reference/lifecycle-callbacks.md), but Impulse has a better way of doing it. Impulse will automatically
remove the event listener when the element is removed from the DOM.

```html{3}
<clip-board>
  <input type="text" value="Copy this value!" readonly>
  <button type="button" data-action="click->clip-board#copy">Copy</button>
</clip-board>
```

Refresh your browser and click on the "Copy" button. You should see the message logged in the developer console.
Learn more about [action descriptors](/reference/actions.md).

## Specifying targets

Next, we will need to get the input's value and copy it to the user's clipboard.

```ts
// clip_board_element.ts
import { ImpulseElement, registerElement } from 'impulse';

@registerElement('clip-board')
export default class ClipBoardElement extends ImpulseElement {
  copy() {
    const input = this.querySelector('input');
    const value = input.value;
    navigator.clipboard.writeText(value); // using the native browser API
  }
}
```

In the above code, we retrieved the value by first querying (`querySelector`) the input value and then accessing the
value attribute of the input element. There's nothing wrong in doing that, but Impulse has a robust way of querying
targets using the `@target()` decorator. [Learn more](/reference/targets.md).

```ts{6,9-10}
// clip_board_element.ts
import { ImpulseElement, registerElement, target } from 'impulse';

@registerElement('clip-board')
export default class ClipBoardElement extends ImpulseElement {
  @target() input; // syntactic sugar for this.querySelector('input')

  copy() {
    const value = this.input.value;
    navigator.clipboard.writeText(value); // using the native browser API
  }
}
```

```html{2}
<clip-board>
  <input type="text" value="Copy this value!" readonly data-target="clip-board.input">
  <button type="button" data-action="click->clip-board#copy">Copy</button>
</clip-board>
```
