# Properties

Properties allow you to read and write HTML attributes.

```html
<lazy-load src="/users"></lazy-load>
```

```ts
// elements/lazy_load_element.ts
import { ImpulseElement, registerElement, property } from 'impulse';

@registerElement('lazy-load')
export default class LazyLoadElement extends ImpulseElement {
  @property() src;

  connected() {
    console.log(this.src); // /users
  }
}
```

## Change callbacks

When property changes, callbacks are triggered so that you can take appropriate actions.

Define a `[property]Changed` function, where `[property]` is the name of the `@property()` decorator. The function
receives `newValue` as the first argument and `oldValue` as the second argument.

```ts
import { ImpulseElement, registerElement, property } from 'impulse';

@registerElement('lazy-load')
export default class LazyLoadElement extends ImpulseElement {
  @property() src;

  srcChanged(newValue, oldValue) {
    this.refetch(newValue);
  }
}
```

## Types

A property can be one of `Array`, `Boolean`, `Number`, `Object`, or `String`, with `String` being the default.

```html
<pop-over placements="['top', 'right']">
</pop-over>
```

```ts
// elements/pop_over_element.ts
import { ImpulseElement, registerElement, property } from 'impulse';

@registerElement('pop-over')
export default class PopOverElement extends ImpulseElement {
  @property({ type: Array }) placements;

  connected() {
    console.log(this.placements); // ['top', 'right']
  }
}
```

## Default property values

Property values that have not been specified on the element can be set as defaults specified in the element definition.

```ts
import { ImpulseElement, registerElement, property } from 'impulse';

@registerElement('lazy-load')
export default class LazyLoadElement extends ImpulseElement {
  @property() src = '/users';

  connected() {
    console.log(this.src); // /users
  }
}
```

This will set the HTML attribute `src` with a value of `/users` on the element.

## Naming conventions

Always use kebab-case in your HTML, and use camelCase in your `.ts` file.

```html
<lazy-load content-type="..."></lazy-load>
```

```ts
import { ImpulseElement, registerElement, property } from 'impulse';

@registerElement('lazy-load')
export default class LazyLoadElement extends ImpulseElement {
  @property() contentType;
}
```
