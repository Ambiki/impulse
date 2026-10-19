# Targets

Targets let you reference element(s) by name.

## Attributes and names

The `data-target` attribute is a space-separated list of target names that can be referenced in the element.

```html{2,3}
<greet-user>
  <div data-target="greet-user.result"></div>
  <div data-target="greet-user.errorMessage"></div>
</greet-user>
```

## Shared targets

An element can have multiple target references.

```html{3,4}
<user-settings>
  <greet-user>
    <div data-target="greet-user.result user-settings.result"></div>
    <div data-target="greet-user.errorMessage"></div>
  </greet-user>
</user-settings>
```

## Single target

A single target can be referenced via the `@target()` decorator. Once the element has
[initialized](/utilities/when-initialized), the property is the matching element, or `null` while none is present.
Before that, it is `undefined`.

```html{2}
<greet-user>
  <div data-target="greet-user.result"></div>
</greet-user>
```

```ts{6}
// elements/greet_user_element.ts
import { ImpulseElement, registerElement, target } from '@ambiki/impulse';

@registerElement('greet-user')
export default class GreetUserElement extends ImpulseElement {
  @target() result: HTMLElement;

  // ...
}
```

A `@target()` property points at one element. A second element carrying the same target name waits: it stays out of the
property until the first one is removed or stops carrying the name, and is then adopted, getting its own
[connected callback](#connected-and-disconnected-callbacks). When several wait, the first in document order is adopted.
Replacing a target by inserting the new element before removing the old one therefore works.

Doing both in one synchronous run of script reports nothing. If the first is still there after that, the second is a
mistake and is [reported like an uncaught error](/utilities/connected#errors). Use
[`@targets()`](#multiple-targets) when several elements share a name.

## Multiple targets

Multiple targets can be referenced via the `@targets()` decorator. Once the element has initialized, the property is
every matching element in document order, and an empty array while there are none — so it is safe to iterate. Reads
can hand out the same array, so treat it as read-only: copy it before sorting or reversing it.

```html{2,3}
<greet-user>
  <div data-target="greet-user.results"></div>
  <div data-target="greet-user.results"></div>
</greet-user>
```

```ts{6}
// elements/greet_user_element.ts
import { ImpulseElement, registerElement, targets } from '@ambiki/impulse';

@registerElement('greet-user')
export default class GreetUserElement extends ImpulseElement {
  @targets() results: HTMLElement[];

  // ...
}
```

## How targets are resolved

A target is not a one-off `querySelector()`. Impulse watches the document, so the property follows the DOM — a target
that is replaced, moved, or rendered later is picked up without any work on your part, which is what makes the
[connected and disconnected callbacks](#connected-and-disconnected-callbacks) possible.

Reading the property reflects the DOM as it is now, even right after a target is appended or removed in the same
method:

```ts
addTag(text: string) {
  this.append(this.renderTag(text));
  // Includes the new tag's button.
  for (const button of this.removeButtons) button.disabled = this.disabled;
}
```

The [connected and disconnected callbacks](#connected-and-disconnected-callbacks) still run when Impulse's
`MutationObserver` delivers the change, a moment after it is made, once the code that made it has finished. Until then,
the property can already hold an element whose connected callback has not run yet, or no longer hold one whose
disconnected callback has not run yet.

Inside a callback Impulse runs as it delivers changes, such as a `[target]Connected` or a
[`connected()`](/utilities/connected) callback, the property reflects the changes delivered so far.

While changes wait to be delivered, a read looks through the element's descendants for its targets and keeps the answer
until the DOM changes again. A loop that changes the DOM and reads the property on every pass repeats that search on
every pass, so read it once after the loop.

Moving the element itself is different: it is torn down and initialized again at its new place, and until it has
[initialized](/utilities/when-initialized) again, the property reads as `null` or an empty array.

A `data-target` token belongs to the closest ancestor (or the element itself) whose tag name matches the identifier in
the token. Nested elements of the same tag therefore never claim each other's targets:

```html{3,7}
<greet-user>
  <!-- Belongs to the outer element. -->
  <div data-target="greet-user.result"></div>

  <greet-user>
    <!-- Belongs to the inner element. -->
    <div data-target="greet-user.result"></div>
  </greet-user>
</greet-user>
```

## Connected and disconnected callbacks

Using the `@target()` or `@targets()` decorator lets you respond whenever a target element is connected or disconnected
from the DOM.

Define a `[target]Connected` or `[target]Disconnected` function, where `[target]` is the name of the target you want to
observe. The function receives the element as the first argument.

```ts{5,7,11}
import { ImpulseElement, registerElement, target } from '@ambiki/impulse';

@registerElement('greet-user')
export default class GreetUserElement extends ImpulseElement {
  @target() result: HTMLElement;

  resultConnected(result: HTMLElement) {
    // result connected to the DOM.
  }

  resultDisconnected(result: HTMLElement) {
    // result disconnected from the DOM.
  }
}
```

## Naming conventions

Always use camelCase to reference the target in your HTML.

```html
<div data-target="greet-user.doThis"></div>
<div data-target="greet-user.avoid_this"></div>
```

```ts
import { ImpulseElement, registerElement, target } from '@ambiki/impulse';

@registerElement('greet-user')
export default class GreetUserElement extends ImpulseElement {
  @target() doThis: HTMLElement;
}
```
