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

A single target can be referenced via the `@target()` decorator. The property is the matching element, or `null`
while none is present.

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

## Multiple targets

Multiple targets can be referenced via the `@targets()` decorator. The property is every matching element in
document order, and an empty array while there are none — so it is always safe to iterate.

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

A target is not a one-off `querySelector()`. Impulse watches the document, so the property always points at whatever
is in the DOM right now — a target that is replaced, moved, or rendered later is picked up without any work on your
part, which is what makes the [connected and disconnected callbacks](#connected-and-disconnected-callbacks) possible.

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
