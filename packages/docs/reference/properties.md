# Properties

Properties allow you to read and write HTML attributes.

```html
<lazy-load src="/users"></lazy-load>
```

```ts{6,9}
// elements/lazy_load_element.ts
import { ImpulseElement, registerElement, property } from 'impulse';

@registerElement('lazy-load')
export default class LazyLoadElement extends ImpulseElement {
  @property() src: string;

  connected() {
    console.log(this.src); // /users
  }
}
```

## Change callbacks

When property changes, callbacks are triggered so that you can take appropriate actions.

Define a `[property]Changed` function, where `[property]` is the name of the `@property()` decorator. The function
receives `newValue` as the first argument and `oldValue` as the second argument.

```ts{7}
import { ImpulseElement, registerElement, property } from 'impulse';

@registerElement('lazy-load')
export default class LazyLoadElement extends ImpulseElement {
  @property() src: string;

  srcChanged(newValue: string, oldValue: string) {
    // ...
  }
}
```

## Types

A property can be one of `Array`, `Boolean`, `Number`, `Object`, or `String`, with `String` being the default.

```html
<pop-over placements="['top', 'right']" open></pop-over>
```

```ts{6-7,10-11}
// elements/pop_over_element.ts
import { ImpulseElement, registerElement, property } from 'impulse';

@registerElement('pop-over')
export default class PopOverElement extends ImpulseElement {
  @property({ type: Array }) placements: string[];
  @property({ type: Boolean }) open: boolean = false;

  connected() {
    console.log(this.placements); // ['top', 'right']
    console.log(this.open); // true
  }
}
```

## Default property values

You can assign a default value to the property and it will be reflected in the element.

```ts{5,8}
import { ImpulseElement, registerElement, property } from 'impulse';

@registerElement('lazy-load')
export default class LazyLoadElement extends ImpulseElement {
  @property() src = '/users';

  connected() {
    console.log(this.src); // /users
  }
}
```

## Naming conventions

Always use kebab-case in your HTML, and use camelCase in your `.ts` file.

```html
<lazy-load content-type="..."></lazy-load>
```

```ts{5}
import { ImpulseElement, registerElement, property } from 'impulse';

@registerElement('lazy-load')
export default class LazyLoadElement extends ImpulseElement {
  @property() contentType: string;
}
```
