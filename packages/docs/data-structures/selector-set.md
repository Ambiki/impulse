# SelectorSet

`SelectorSet` stores values against CSS selectors and answers two questions without testing every selector one at a
time: "which of these selectors could match this element?" and "which elements under here do they reach?" Impulse uses
it to keep [`on`](/utilities/on) delegation and its shared DOM observer cheap no matter how many selectors are
registered.

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

The results belong to the set and are only valid until the next `matches()` call, which reuses them. Read them and let
them go — retaining or mutating one corrupts the index.

## How the index works

Each selector is filed under the key token of its *subject* — the rightmost compound of each comma-separated part —
preferring `#id`, then `[attribute]`, then `.class`, then the tag name, since a rarer key means fewer candidates.
`form > button` is filed under the `button` tag, `[data-target]` under the `data-target` attribute, and `div, .foo`
under both `div` and `.foo`. When an element comes in, only the buckets for its tag name, id, class names, and the
attributes it actually carries are consulted.

An attribute is filed under both the name as written and its lowercase form, because an HTML element stores attribute
names lowercased while an SVG or MathML element keeps the case it was written in. `[viewBox]` finds an `<svg>`, and
`[data-Case-Watch]` finds a `<span data-case-watch>`.

A selector that cannot be filed goes into a catch-all bucket that is checked against every element. That happens when
any one of its comma-separated parts has a subject with no such token — `:is(...)`, `*`, a namespaced `[xlink|href]` —
or when the selector contains an escape sequence or a comment anywhere in it. One unindexable part is enough:
`div, :is(a, span)` goes to the catch-all whole, `div` included. Those selectors still work; they are just not
narrowed.

## Querying a subtree

`queryAll()` and `querySubjects()` both return the descendants of a context element, and both skip the context itself,
the way `querySelectorAll` does. They differ in what they ask for, because a subtree still in the document and one that
has just left it are not the same problem.

```ts
const watchers = new SelectorSet<Watcher>();
watchers.add('.open .item', watcher);

section.append(item); // `.open` is an ancestor of `section`
watchers.queryAll(section); // [item] — the selector resolves against the whole document

section.remove();
watchers.queryAll(section); // [] — detached, so `.open` is out of reach
watchers.querySubjects(section); // [item] — found by the subject `.item` alone
```

`queryAll()` queries the registered selectors themselves, so every element it returns really does match one of them.
Use it while the subtree is in the document: `querySelectorAll` resolves a selector against the whole document before
narrowing to descendants, so a selector anchored on an ancestor outside the context still works.

`querySubjects()` queries each selector's subject instead — `.open .item:hover` becomes `.item` — which every element
the full selector matched still matches. Use it once the subtree is detached, where an anchored selector can no longer
match anything inside it. The result is a **superset**: filter it against whatever state you keep about which elements
you were tracking. It degrades to every element when some selector has no queryable subject at all.

Both cache the selector they build, rebuilding it only when the set gains or loses a distinct selector. A subject
shared between selectors is contributed once, since querying costs more for every part the selector carries.

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

| Member                     | Description                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| `add(selector, value)`     | Indexes `value` under `selector`.                                                        |
| `delete(selector, value)`  | Removes one entry for the pair. A no-op when the pair was never added.                   |
| `matches(element)`         | Every entry whose selector could match `element`, as `{ selector, value }`.               |
| `queryAll(context)`        | Descendants of `context` matching any indexed selector, for a subtree in the document.   |
| `querySubjects(context)`   | Descendants of `context` matching any indexed selector's subject, for a detached subtree. |
| `size`                     | How many entries are indexed.                                                            |
