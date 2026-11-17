# Testing

An Impulse element is plain DOM: a test finds it, clicks it, and reads it the way it would any other element, with
whatever the test already uses for the DOM. The one thing a test cannot see in the DOM is Impulse's own scheduling: when
an element is initialized, and when a change to the DOM has been delivered. `@ambiki/impulse/testing` waits for both.

```ts
import { cleanup, fixture, recordEvents, whenSettled } from '@ambiki/impulse/testing';
```

It works with any test runner, and depends on none.

## What to await

Impulse initializes an element, and delivers a change to the DOM, in microtasks after the code that caused it has run.
A test that appends a target and then asserts that its `[target]Connected()` ran asserts too early. Wait for the
document to be **Settled**:

- no change is waiting to be delivered,
- no connected custom element is undefined, and
- every connected Impulse element is initialized.

```ts
group.append(item); // an <accordion-item>, or a <div data-target="accordion-group.items">
await whenSettled();

expect(group.items).to.have.length(3);
```

Don't sleep instead. A frame (`nextFrame()`) or a timeout is long enough for most changes, by accident, and too short
for an element whose JavaScript is still loading. Waiting for each element with
[`whenInitialized`](/utilities/when-initialized) misses the nested ones and a change delivered to an element that is
already initialized.

## fixture

```ts
fixture<T extends Element>(html: string, options?: { timeout?: number }): Promise<T>
```

Puts the markup in a `<div>` of its own on `<body>`, and resolves with its first element once the document is Settled.
The `<div>` is removed after the test.

```ts
const accordion = await fixture<AccordionItemElement>(`
  <accordion-item>
    <button data-target="accordion-item.toggleButton" data-action="click->accordion-item#toggle">Options</button>
    <div data-target="accordion-item.panel" hidden></div>
  </accordion-item>
`);

expect(accordion.panel.hidden).to.be.true;
```

It takes a string only, and throws if the markup holds no element. The markup is parsed as `innerHTML` is: a `<script>`
in it does not run, and a `<tr>` belongs in a `<table>`.

## whenSettled

```ts
whenSettled(options?: { timeout?: number }): Promise<void>
```

Resolves once the document is Settled. Call it after changing the DOM, before asserting on what Impulse does with the
change: setting a `data-target`, appending an element, or removing one.

Settled is a state of the whole document, open shadow trees included, never of a subtree. An element the code under test
appends outside the fixture, such as a toast on `<body>`, is waited for too. A custom element whose name can never be
defined, such as `<tr is="vue:row">`, does not count.

An undefined custom element holds the wait rather than failing it, so an element loaded with
[`lazyImport`](/utilities/lazy-import) is waited for while its JavaScript loads. A typo or a missing import fails the
wait at its deadline, with the tag named.

## recordEvents

```ts
recordEvents(target: EventTarget, types: string[], options?: { self?: boolean }): Recording

interface Recording {
  readonly events: Event[];
  readonly types: string[];
  waitFor<E extends Event = Event>(type: string, options?: { timeout?: number }): Promise<E>;
  stop(): void;
}
```

Starts a Recording: the events of those types that reach `target` from now on, in the order they were dispatched. Write
the types in full, prefix included (`'accordion-item:show'`, not `'show'`).

```ts
const recording = recordEvents(accordion, ['accordion-item:show', 'accordion-item:shown']);
accordion.toggleButton.click();
await recording.waitFor('accordion-item:shown');

expect(recording.types).to.eql(['accordion-item:show', 'accordion-item:shown']);
```

- Like a `data-action` on `target`, it keeps the events bubbling up from its descendants. With `self: true`, like the
  `.self` modifier, it keeps only the ones `target` dispatched.
- Unlike a `data-action`, it listens in the capture phase, so it records an event before any listener on a descendant,
  or any bubbling listener on `target`, has run. Those can neither stop the event from being recorded nor have an event
  they dispatch recorded ahead of it.
- `events` is the live array of recorded events, and `types` their `type` strings, which is what an assertion should
  compare.
- `waitFor(type)` resolves with the earliest recorded `type` event that an earlier `waitFor` has not handed out. It
  resolves at once when that event was dispatched before the call, so a test cannot start listening too late, and two
  calls resolve with two different events. It rejects at once for a type the Recording does not keep.
- `waitFor` never resolves while the event is still being dispatched, so every listener has run by the time the test
  goes on, also for an event the browser dispatches itself, such as `transitionend`.
- `waitFor` resolves with an `Event`. Name the type to read more from it:
  `await recording.waitFor<CustomEvent<{ id: string }>>('accordion-item:shown')`. The type is not checked.
- `stop()` ends the Recording early. A `waitFor` still pending rejects.

## cleanup

```ts
cleanup(): void
```

Stops every Recording, then removes every fixture. It runs after each test on its own when the runner has `afterEach` as
a global, which Mocha, Jest, and Vitest with `globals` do. With any other runner, register it once:

```ts
import { afterEach } from 'vitest';
import { cleanup } from '@ambiki/impulse/testing';

afterEach(cleanup);
```

It registers itself as `@ambiki/impulse/testing` is imported, so import it once the runner has defined `afterEach`: from
a test file, or from Jest's `setupFilesAfterEnv` rather than its `setupFiles`. Imported earlier, the first fixture or
Recording warns that nothing was registered.

## Deadlines

Every wait gives up after 1000ms, less than any runner's own timeout, so a test fails naming what it was waiting on
rather than as a timeout that names nothing. Pass `timeout` (in milliseconds) to change it for one call, or `Infinity`
for no deadline.

```txt
Not settled within 1000ms: <acordion-item> is not defined; <accordion-item> is not initialized.
No "accordion-item:shown" within 1000ms. Recorded: accordion-item:show.
```

The first reads: `<acordion-item>` is a typo, so it is never defined, and the `<accordion-item>` around it waits for it
(see the deprecated wait in [lifecycle callbacks](/reference/lifecycle-callbacks#target-connected)).

## Standing in for a third-party custom element

A fixture that holds a custom element the test does not import, such as a date picker from another package, is never
Settled: the element is never defined. Import the element where the test can afford it. Otherwise, define a stand-in
once, before the first fixture that holds it:

```ts
// The real <date-picker> is not needed to test <booking-form>.
if (!customElements.get('date-picker')) customElements.define('date-picker', class extends HTMLElement {});
```

A name can be defined once per page, so a stand-in defined in one test file is the definition for every later test that
shares the page.

## Limits

- An Impulse element in a closed shadow root is out of reach. Wait for it with
  [`whenInitialized`](/utilities/when-initialized).
- The helpers use the real timers they captured when they were imported, so a test can enable fake timers. Enable them
  inside a test, not globally before the import.
- `cleanup()` removes fixtures only. An element a test's code appends elsewhere is the test's to remove.

## Environments

Impulse is tested in Chromium, Firefox, and WebKit. `@ambiki/impulse/testing` is tested there too, and in jsdom, where
Jest suites run. It is published as ES modules and as CommonJS: Jest, in its default mode, loads `@ambiki/impulse`
through `require`, and the testing entry point loads the same one, so a test's elements are instances of the same
`ImpulseElement`.

## System tests

A system test (Capybara, Playwright) drives the page from outside and cannot call `whenSettled()`. An Impulse element
carries the `data-impulse-element` attribute exactly while it is initialized, so wait on the element you are about to
drive:

::: code-group

```rb [Capybara]
find('accordion-item[data-impulse-element]').click_button('Options')
```

```ts [Playwright]
await page.locator('accordion-item[data-impulse-element]').getByRole('button', { name: 'Options' }).click();
```

:::

The attribute is for code outside the page. Code inside the page checks [`isInitialized`](/utilities/is-initialized),
which an attribute copied by `cloneNode` or written into the markup cannot fool.
