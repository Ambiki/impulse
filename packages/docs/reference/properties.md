# Properties

Properties allow you to read and write HTML attributes. A `@property()` is defined on the element when it connects.
From then on, reading it reads the attribute and assigning it writes the attribute.

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
argument and `oldValue` as the second. It does not run for the initial value, before the element has
[initialized](/utilities/when-initialized), or once the element has been torn down after disconnecting. A change made
from `disconnected()` still runs it.

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
`{"foo":"bar"}`, or its keys reordered), or an attribute removed when it already read as the default. `Array` and
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
[change callback](#change-callbacks) always agree. A missing attribute reads as the property's
[default](#default-property-values), and so does one that does not parse as its type: an empty or non-numeric
`Number`, or an `Array` or `Object` attribute that is not valid JSON of that kind. Any value is a valid `String`, the
empty one included. A `Boolean` attribute reads as `true` whenever it is present, unless its value is `"false"`.

## Default property values

Assign a value to the property to give it a default: what the property reads as while its attribute is missing.

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

The default lives only in JavaScript. Connecting does not write it to the attribute, so `getAttribute('src')` returns
`null` and a selector such as `[src="/users"]` does not match. Render the attribute from the server when CSS or other
code needs to see it. Since the element holds no attribute the server's HTML lacks, a morph (a Turbo page refresh, for
example) that syncs the element to that HTML leaves its defaults alone.

If the attribute is present, it wins over the default. Once it is removed, by hand or by a morph, the property reads
the default again, and the change callback receives it.

A property without a default, or initialized to `null` or `undefined`, defaults to its type's empty value: `''`, `0`,
`false`, `[]`, or `{}`. An `Array` or `Object` default is copied on every read, so mutating what the property returns
never changes the default. A value assigned before the element connects is taken as the default as well, so it is not
written to the attribute either.

## Assigning values

Assigning a property writes its attribute, even when the value equals the default:

```ts
element.src = '/posts'; // src="/posts"
element.src = '/users'; // src="/users"
element.src = null; // removes `src`, so `element.src` reads the default, '/users'
```

Assigning `null` or `undefined` removes the attribute, which resets the property to its default.

A `Boolean` set to `true` writes an empty attribute (`open=""`). Set to `false`, it removes the attribute, so `[open]`
selectors stop matching. A `Boolean` that defaults to `true` is the exception: a missing attribute would read as
`true`, so `false` is written as `flip="false"`.

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

Write acronyms as words: `fooUrl`, not `fooURL`. The attribute for `fooURL` is `foo-url`, which maps back to `fooUrl`,
so a `fooURLChanged` callback would never run.
