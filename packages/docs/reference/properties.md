# Properties

Properties allow you to read and write HTML attributes. A `@property()` is defined on the element once it is
constructed. From then on, reading it reads the attribute and assigning it writes the attribute.

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
argument and `oldValue` as the second. It does not run for the value the element connects with, before it has
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

A property can be one of `Array`, `Boolean`, `Number`, `Object`, or `String`, with `String` being the default, or a
[type of your own](#custom-types).

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

A property without a default, or with `null` or `undefined` as its default, reads as its type's empty value: `''`,
`0`, `false`, `[]`, or `{}`. An `Array` or `Object` default is copied on every read, so mutating what the property
returns never changes the default.

A value assigned before the element connects, as in `element.open = true` on an element you just created, is not a
default: it is written to the attribute like any assignment. This takes `@registerElement`. A class registered with
`customElements.define` instead defines its properties when it first connects, so a value assigned before that
becomes the default.

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

## Custom types

When none of the built-in types fits, such as for a `Date`, pass a type of your own. A type is an object with two
functions: `fromAttribute` reads the attribute as a value, and `toAttribute` writes a value back.

```ts
// elements/types.ts
import type { PropertyType } from '@ambiki/impulse';

export const dateType = {
  fromAttribute(attribute) {
    const date = new Date(attribute);
    return Number.isNaN(date.getTime()) ? undefined : date;
  },
  toAttribute: (date) => date.toISOString(),
} satisfies PropertyType<Date>;
```

```html
<blog-post published-at="2026-11-17T10:00:00.000Z"></blog-post>
```

```ts{7,10}
// elements/blog_post_element.ts
import { ImpulseElement, registerElement, property } from '@ambiki/impulse';
import { dateType } from './types';

@registerElement('blog-post')
export default class BlogPostElement extends ImpulseElement {
  @property({ type: dateType }) publishedAt: Date | null;

  connected() {
    console.log(this.publishedAt?.getFullYear()); // 2026
  }
}
```

`fromAttribute` returns `undefined` or `null` for an attribute it cannot read, such as `published-at="soon"`, and the
property then reads its [default](#default-property-values), as it does for the built-in types. It is never called for
a missing attribute, which reads as the default.

`toAttribute` returns the attribute to write. It is never called with `null` or `undefined`, since assigning either
removes the attribute. It can return `null` to remove the attribute too, after which the property reads its default,
so return `null` only for a value equal to the default. That default is its second argument, which is how a `Boolean`
writes `false` as `flip="false"` when it defaults to `true`.

An error either function throws as you read or assign the property reaches your code. One thrown as the attribute
changes, while the old and new values are read for the change callback, is reported like an uncaught error, and the
change callbacks of other properties reading that attribute still run. Return `undefined` for input you cannot read
rather than throwing.

### Comparing values

The [change callback](#change-callbacks) runs only when the value changes. Without anything more, two values are the
same when `toAttribute` writes the same attribute for both, so `2026-11-17T14:00:00+04:00` rewritten as
`2026-11-17T10:00:00.000Z` does not run it: both are the same instant. Give the type an `isEqual(left, right)` to
compare another way. It is never called with `null`.

A list of tokens held in a `Set` needs one, since `toAttribute` writes the tokens in the order they were added, and
`tags="news sports"` rewritten as `tags="sports news"` would otherwise count as a change:

```ts
export const tokenListType = {
  fromAttribute: (attribute) => new Set(attribute.split(/\s+/).filter(Boolean)),
  toAttribute: (tokens) => Array.from(tokens).join(' '),
  isEqual: (left, right) => left.size === right.size && Array.from(left).every((token) => right.has(token)),
  emptyValue: new Set<string>(),
} satisfies PropertyType<Set<string>>;
```

### Empty values and defaults

Without a default, a property of your own type reads `null` while its attribute is missing, so declare its field as
`Date | null`. A type that has an empty value, such as the empty `Set` above, names it as `emptyValue`, and a property
without a default reads that instead.

A default, or an `emptyValue`, is read as the attribute holding it would be: written with `toAttribute` and read back
with `fromAttribute`. Every read is a fresh value, so mutating what the property returns never changes the default.

A default that does not survive the trip, because `toAttribute` writes it as `null` or `fromAttribute` cannot read it
back, reads as itself when it is a primitive, such as a number. An object would have to be handed out itself, where a
mutation would change the default, or for an `emptyValue` the default of every element using the type, so reading one
throws a `TypeError` instead. A type that writes an empty `Set` as `null`, for example, cannot name an empty `Set` as
its `emptyValue`.

::: tip Coming from Lit?
Lit's `converter` is `type` here, and its `hasChanged` is the type's `isEqual`, which lives in the type because how two
values compare follows from how they were read.
:::

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

An acronym dasherizes as one word: `fooURL` reads the `foo-url` attribute, and its change callback is `fooURLChanged`.
Two properties that dasherize alike, such as `fooURL` and `fooUrl`, read the same attribute, and a change to it calls
both callbacks.
