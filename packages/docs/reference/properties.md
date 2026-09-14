# Properties

Properties allow you to read and write HTML attributes.

```html
<lazy-load src="/users"></lazy-load>
```

```ts{6,9}
// elements/lazy_load_element.ts
import { ImpulseElement, registerElement, property } from '@ambiki/impulse';

@registerElement('lazy-load')
export default class LazyLoadElement extends ImpulseElement {
  @property() src: string;

  connected() {
    console.log(this.src); // /users
  }
}
```

## Change callbacks

When a property changes, its callback runs so you can react to the new value.

Define a `[property]Changed` function, where `[property]` is the property name. It receives `newValue` as the first
argument and `oldValue` as the second.

```ts{7}
import { ImpulseElement, registerElement, property } from '@ambiki/impulse';

@registerElement('lazy-load')
export default class LazyLoadElement extends ImpulseElement {
  @property() src: string;

  srcChanged(newValue: string, oldValue: string) {
    // ...
  }
}
```

The callback only runs when the converted value actually changes. An attribute write that reads back as the same
value is a no-op: `8_000` rewritten as `8000`, an `Array` or `Object` attribute reformatted (`{ "foo": "bar" }` to
`{"foo":"bar"}`, or its keys reordered), or an attribute removed when it already read as the empty value. `Array` and
`Object` values are compared structurally, so a server re-render that emits the same data in a different shape of JSON
does not re-trigger downstream effects.

## Types

A property can be one of `Array`, `Boolean`, `Number`, `Object`, or `String`, with `String` being the default.

```html
<pop-over placements='["top", "right"]' open></pop-over>
```

```ts{6-7,10-11}
// elements/pop_over_element.ts
import { ImpulseElement, registerElement, property } from '@ambiki/impulse';

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

Attribute values are converted on read, so `this.property` and the value passed to the
[change callback](#change-callbacks) always agree. A missing attribute reads as the type's empty value — `''`, `0`,
`false`, `[]`, or `{}` — and an `Array` or `Object` attribute that is not valid JSON falls back to `[]` or `{}`
rather than throwing.

## Default property values

You can assign a default value to the property and it will be reflected in the element.

```ts{5,8}
import { ImpulseElement, registerElement, property } from '@ambiki/impulse';

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
import { ImpulseElement, registerElement, property } from '@ambiki/impulse';

@registerElement('lazy-load')
export default class LazyLoadElement extends ImpulseElement {
  @property() contentType: string;
}
```
