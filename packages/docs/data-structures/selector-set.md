# SelectorSet

`SelectorSet` stores values against CSS selectors and answers "which of these selectors could match this element?"
without testing every selector one at a time. Impulse uses it to keep [`on`](/utilities/on) delegation and its shared
DOM observer cheap no matter how many selectors are registered.

## Usage

```ts
import { SelectorSet } from '@ambiki/impulse';

const handlers = new SelectorSet<() => void>();

handlers.add('button.primary', submit);
handlers.add('form > button', cancel);

for (const { selector, value } of handlers.matches(element)) {
  if (element.matches(selector)) value();
}
```

`matches()` returns **candidates**, not matches. The index narrows the search space; it does not validate the whole
selector, so run `element.matches(selector)` on what comes back. Each entry is returned once even when its selector is
indexed under several keys.

## How the index works

Each selector is filed under the key token of its *subject* — the rightmost compound of each comma-separated part —
preferring `#id`, then `.class`, then the tag name. `form > button` is filed under the `button` tag, and `div, .foo`
under both `div` and `.foo`. When an element comes in, only the buckets for its tag name, id, and class names are
consulted.

A selector that cannot be filed goes into a catch-all bucket that is checked against every element. That happens when
any one of its comma-separated parts has a subject with no such token — `[data-x]`, `:is(...)`, `*` — or when the
selector contains an escape sequence anywhere in it. One unindexable part is enough: `div, [data-x]` goes to the
catch-all whole, `div` included. Those selectors still work; they are just not narrowed.

## Duplicates

Adding the same selector and value twice stores two entries, and each needs its own `delete()`.

```ts
handlers.add('button', submit);
handlers.add('button', submit);
handlers.size; // 2

handlers.delete('button', submit);
handlers.size; // 1
```

## API

| Member                     | Description                                                                    |
| -------------------------- | ------------------------------------------------------------------------------ |
| `add(selector, value)`     | Indexes `value` under `selector`.                                               |
| `delete(selector, value)`  | Removes one entry for the pair. A no-op when the pair was never added.          |
| `matches(element)`         | Every entry whose selector could match `element`, as `{ selector, value }`.     |
| `size`                     | How many entries are indexed.                                                   |
