# Insertion and removal query different selectors

The shared document observer used to walk `querySelectorAll('*')` over every added and removed subtree and consult the
index for each element, which cost 20,000 `Element.matches()` calls to swap a 10,000-element `<body>` holding two
Watchers. Both walks are now `querySelectorAll` of the registered selectors, joined — but not the same selectors. An
added subtree is in the document when its record is delivered, so the Watchers' own selectors resolve, ancestors and
all. A removed subtree is detached by then, so an anchored selector matches nothing inside it and each Watcher is
reduced to its Subject instead, which is a superset: every element a Watcher tracked still matches the Subject it was
found by.

Two things follow that a reader would otherwise find surprising.

`processAttributeChange` now disconnects an element it finds already detached, where it used to return and leave the
removal to the child list record in the same batch. That deferral only held while removal walked every element. It
enumerates by Subject now, and an attribute record is delivered *before* the removal that follows it in the same task —
so `item.classList.remove('item')` followed by `section.remove()` would leave the element tracked forever.

`SelectorSet` gained an attribute index, which `selector-set` upstream does not have. Its indexes stop at `#id`,
`.class` and `tag`, and Impulse's own two selectors are `[data-target]` and `[data-action]` — attribute-only compounds
that fall into the catch-all bucket, so every element in a walk was offered both Watchers and tested against both. The
index probes by name (`hasAttribute`) rather than reading `element.attributes`, because a document holds far more
elements than a set holds attribute selectors, and both `element.attributes` and `getAttributeNames()` materialize
something per call.

Against `main`, 10 Rounds per Variant in Chromium: `body-swap` −57.0%, `watchers-many/create` −48.1%,
`table-single-owner/create` −31.0%, `table-row-elements/move` −27.5%, `/clear` −21.1%, `attributes-fallback` −13.2%.
One Scenario is slower, `watchers-many/clear` at +13.5%; see the second option below.

## Considered Options

- **A query per Watcher, as v1.1.0 did.** Exact — the query *is* the match, so no index lookup and no `matches()` call
  at all. It scales with the number of Watchers, though, and one `append()` of a 5,000-row fragment is 5,000 records,
  so a page with 25 `lazyImport` calls would issue 125,000 queries instead of 5,000.
- **Keeping `*` on removal.** Measured by swapping only `walkRemoved` back: `table-row-elements/clear` returns to
  parity with the Baseline and `body-swap` gives up about a third of its gain. `*` wins in exactly one shape, the one
  the `watchers-many/clear` Scenario captures — many registered selectors, many tiny removed subtrees — where the
  Subject query is the sole remaining regression at +13.5%. The cost driver is the number of parts in the joined
  selector, not the size of the subtree, so a threshold on part count would get both; that is a magic number nobody can
  see from the outside, and it is not paid for yet.
- **Deriving `attributeFilter` from the Subject too, so it is never `null`.** The natural companion: a Watcher would
  then take attribute records only for its own Subject's attributes, and `attributeFilter` would stop degrading to
  every attribute on the page whenever one registered selector has a combinator. Deferred — it changes what
  `connected('.button > a')` observes, and it moved no Scenario, because the `attributes-fallback` cost turned out to
  be per-record allocation rather than record volume. `attributeFilter` stays nullable and combinator selectors keep
  the semantics they have.
- **A `filter` option on `connected()`, or an imperative `revalidate(root)`.** Both were designed and dropped with the
  above. No Scenario asks for either, and `selector-observer` shows the escape hatch is only worth adding once
  something needs it.
