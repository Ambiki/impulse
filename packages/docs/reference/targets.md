# Targets

Targets let you reference element(s) by name.

## Attributes and names

The `data-target` attribute is a space-separated list of target names that can be referenced in the element.

```html
<greet-user>
  <div data-target="greet-user.result"></div>
  <div data-target="greet-user.errorMessage"></div>
</greet-user>
```

## Shared targets

An element can have multiple target references.

```html
<user-settings>
  <greet-user>
    <div data-target="greet-user.result user-settings.result"></div>
    <div data-target="greet-user.errorMessage"></div>
  </greet-user>
</user-settings>
```

## Single target

A single target can be referenced via the `@target()` decorator. It is a syntactic sugar for `this.querySelector('*')`.

```html
<greet-user>
  <div data-target="greet-user.result"></div>
</greet-user>
```

```ts
// elements/greet_user_element.ts
import { ImpulseElement, registerElement, target } from 'impulse';

@registerElement('greet-user')
export default class GreetUserElement extends ImpulseElement {
  @target() result;

  // ...
}
```

## Multiple targets

Multiple targets can be referenced via the `@targets()` decorator. It is a syntactic sugar for `Array.from(this.querySelectorAll('*'))`.


```html
<greet-user>
  <div data-target="greet-user.results"></div>
  <div data-target="greet-user.results"></div>
</greet-user>
```

```ts
// elements/greet_user_element.ts
import { ImpulseElement, registerElement, targets } from 'impulse';

@registerElement('greet-user')
export default class GreetUserElement extends ImpulseElement {
  @targets() results;

  // ...
}
```

## Connected and disconnected callbacks

Using the `@target()` or `@targets()` decorator lets you respond whenever a target element is added or removed from
the DOM.

Define a `[name]Connected` or `[name]Disconnected` function, where `[name]` is the name of the target you want to
observe. The function receives the element as the first argument.

```ts
import { ImpulseElement, registerElement, target } from 'impulse';

@registerElement('greet-user')
export default class GreetUserElement extends ImpulseElement {
  @target() result;

  resultConnected(element) {
    // element appeared on the DOM.
  }

  resultDisconnected(element) {
    // element removed from the DOM.
  }
}
```

## Naming conventions

Always use camelCase to reference the target in your HTML.

```html
<div data-target="greet-user.doThis"></div>
<div data-target="greet-user.avoid-this"></div>
```

```ts
import { ImpulseElement, registerElement, target } from 'impulse';

@registerElement('greet-user')
export default class GreetUserElement extends ImpulseElement {
  @target() doThis;
}
```
