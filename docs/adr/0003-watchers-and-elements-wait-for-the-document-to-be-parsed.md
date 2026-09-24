# Watchers and elements wait for the document to be Parsed

While a document is being parsed, the parser inserts each element before any of its children, and it runs microtasks
at points of its own choosing: after every script it executes, and just before it constructs a custom element whose
class is already defined. A MutationObserver record delivered at one of those checkpoints hands a Watcher an element
whose subtree is incomplete. In Ambiki (Ambiki/ambiki#8576), `connected('#billingDataModal', ...)` is registered from a
blocking `<head>` script and fired at the checkpoint before the modal's `<awc-autocomplete>`; the page script it
imported looked up the select and threw. A reduced page shows the same in Chromium, Firefox and WebKit: the callback
runs with 3 of the modal's 46 descendants parsed. `connected()` and `disconnected()` (#60) were the only entry points
that did not wait. So no Watcher sees an element until the document is Parsed. A Watcher registered while `readyState`
is `loading` joins the index on `DOMContentLoaded`, the event `whenParsed()` resolves on, so it matches elements just as
they begin to initialize; one registered later scans synchronously, as before. Every Watcher registered during the
parse joins at once and the document is walked once for all of them. `selector-observer` holds
its observer back the same way (`whenReady`).

The rule is enforced in two places, because Impulse hears about elements in two ways. Watchers cover `connected()`,
`disconnected()` and `lazyImport()`, whose own `whenParsed()` wait becomes redundant. An `ImpulseElement` hears about
itself through `connectedCallback`, a custom element reaction the parser runs when it inserts the element, which no
Watcher can defer, so `_asyncConnect` keeps its `await whenParsed()` (formerly `domReady()`): the descendant upgrade,
the `:not(:defined)` snapshot, the target and action replay and the `connected()` hook all read the subtree. #32
removed that wait and #49 put it back. It has a second job once the document is Parsed: it yields one microtask, so
code that appends an element and then its children finishes before the element initializes.

`disconnected()` defers too, so a Watcher only ever disconnects elements it connected. An element added and removed
while the document is still loading is invisible to both.

`on()` handlers still run during the parse. The rule is about elements arriving, whose subtrees may be incomplete; an
`on()` handler answers an event on an element the user can already see, and deferring it would drop or delay input.

The cost: on a long page, whatever a `connected()` callback does, such as hiding or enhancing an element, waits for the
whole parse, so unenhanced content can show briefly where it used to be fixed up as it streamed in.

## Considered Options

- **Keep firing early and have each caller guard itself.** The fix proposed for the billing modal: `init` returns and
  re-runs on `DOMContentLoaded` while `readyState` is `loading`. It works, but every callback that reads descendants
  needs it, nothing tells an author so, and forgetting it fails only on timing. When the imported chunk is already
  loaded, `init` runs inside the same checkpoint; when it has to be fetched, it usually runs after the parse, so the
  failure comes and goes.
- **Track matches during the parse and defer only the connect callback.** `connected()` would behave the same, but a
  standalone `disconnected()` would report the removal of an element no callback was ever told had arrived.
- **Firing on `readystatechange` to `interactive`.** The earliest moment the document is Parsed, but it comes before
  `defer` scripts run, and whether it comes before an application's own `interactive` handlers depends on who
  registered first. Turbo fires `turbo:load` there, and Ambiki sets up selectize and axios in that handler, which the
  billing modal's page script reads.
- **Wait for the element's own subtree rather than the whole document.** Nothing reports that an element's end tag has
  been parsed. The nearest proxy, a following sibling appearing, never comes for the last child of its parent. The
  document being Parsed is the only signal the platform gives.
