# Tests wait for a Settled document

A test that puts an Impulse element in the document, or changes the DOM around one, has to wait for Impulse before it
asserts, and nothing said what to wait for. Suites waited a frame (`nextFrame()`, 192 times in Impulse's own suite), a
timeout, or one `whenInitialized()` per element. `@ambiki/impulse/testing` waits for one state instead: the document is
**Settled** when no change is waiting to be delivered, no connected custom element is undefined, and every connected
Impulse element is Initialized. `whenSettled()` waits for it, and `fixture()` puts a Fixture in the document and then
waits for it.

Settled is a state of the whole document, open shadow trees included, never of a subtree. Delivery is document-wide,
and a test's elements land outside its Fixture (a toast appended to `<body>`).

`whenSettled()` is built on the public API alone, from the testing entry point, so nothing is tracked in production for
the sake of tests. Impulse delivers changes and initializes elements in microtasks, so waiting one task runs whatever it
had pending. It then checks the document: every element matching `:not(:defined)` and every `ImpulseElement` that
`isInitialized()` says is not Initialized, in the document and in each open shadow root. Until that check comes back
empty it waits another task and checks again, and at the deadline (1000ms unless the caller gives one) it rejects naming
what it was still waiting on.

An undefined element holds the wait rather than failing it at once, so an element whose `lazyImport()` is still in
flight is waited for, and a typo or a missing import fails at the deadline with the tag named. An element whose name no
definition can have, such as the `vue:row` of `<tr is="vue:row">`, does not count. The browser says which names those
are: `customElements.whenDefined()` rejects one at once, so a name it has not rejected by the next task is one a
definition can have. A name seen for the first time therefore costs one more task before the document can be called
Settled.

## Considered Options

- **Wait for a subtree, such as the Fixture.** It misses an element the code under test appends elsewhere, and a change
  waiting to be delivered anywhere can still run callbacks inside the subtree.
- **Let the main entry point report what it has pending.** Exact, and no polling, but it adds state to every page for
  the sake of tests, and a hook the testing entry point would depend on that no application needs.
- **Wait a frame**, as the suites did. A frame is a sleep that happens to be long enough for most changes, and too short
  for a lazily defined element.
- **Wake on `whenDefined()` and `whenInitialized()` instead of every task.** Neither says when a blocking element is
  removed, so the wait would also need a timer, and each round would add a waiter to every element still blocking.
- **Fail at once on an undefined element.** A `lazyImport()` still in flight would fail every test whose Fixture holds
  its element.

## Consequences

- While the document is not Settled, every task walks it. Test documents are small.
- An Impulse element in a closed shadow root is out of reach. A test waits for it with `whenInitialized()`.
- The waits use the timers the module captured when it was imported, so a test can install fake timers, but not before
  the import.
- Impulse's own suite does not use the testing entry point. It tests `isInitialized()` and `whenInitialized()`, which
  the wait is built on, and asserts the order changes are delivered in, so it keeps a clock that knows nothing about
  Impulse.
