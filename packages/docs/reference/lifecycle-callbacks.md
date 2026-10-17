# Lifecycle callbacks

Lifecycle callbacks let you respond whenever an element or target is connected to or disconnected from the DOM.

## Functions

When an element initializes, these functions are invoked in the order shown below, with actions bound after the
`[target]Connected()` callbacks and before `connected()`. Initialization waits until the document is parsed (see
[before the document is parsed](/utilities/connected#before-the-document-is-parsed)), so events fired on the element
before then are missed. A target added after the element has initialized gets its `[target]Connected()` call at that
point, after `connected()`.

### `constructor()`

This function is called when the element is created. Within this function, you can perform one-time initialization
tasks, such as declaring properties.

::: warning
You should not query the DOM within the `constructor` function and always call `super()` when using it.
:::

```ts
constructor() {
  super();
  this.interval = 500;
}
```

### `[target]Connected()`

This function is called when the declared `target` / `targets` is connected to the DOM. Within this function, you can
manipulate the target — most commonly setting HTML attributes and adding event listeners. Anything done here should be
undone when the target is disconnected from the DOM.

```ts
@target() panel: HTMLElement;
@targets() buttons: HTMLButtonElement[];

panelConnected(panel: HTMLElement) {
  console.log('panel connected to the DOM: ', panel);
}

buttonsConnected(button: HTMLButtonElement) {
  console.log('button connected to the DOM: ', button);
}
```

::: warning Deprecated behavior
When this callback fires, the target element is in the DOM, and its `@property` accessors exist if its class is defined.
It may not have finished initializing, though, and a target whose class is not defined yet (one loaded with
[`lazyImport`](/utilities/lazy-import), for example) has no accessors at all.

Today, each time an element initializes, Impulse waits for every undefined custom element inside it to be defined
before invoking these callbacks, binding actions and calling `connected()`. A descendant that is never defined, such as
a mistyped tag, keeps the element from initializing. Targets added later are not waited for. **This implicit wait is
deprecated and will be removed in the next major version.**

If a connected callback reads properties on a target element, await
[`whenInitialized`](/utilities/when-initialized) inside the callback instead:

```ts
async panelConnected(panel: PanelElement) {
  await whenInitialized(panel);
  console.log(panel.someProperty);
}
```

Once you have migrated, silence the deprecation warning by setting `ImpulseElement.migratedToWhenInitialized = true`,
or set `migratedToWhenInitialized` on a single element class. The flag only silences the warning; the wait still runs.
:::

### `connected()`

This function is called when the element itself is connected to the DOM. When this function is invoked, you can be sure
that all properties and targets have been resolved and added to the DOM, and
[`isInitialized(this)`](/utilities/is-initialized) is `true`. You can query the DOM within this function, set event
listeners, and do much more. Anything done within this function should be undone when the element is disconnected from
the DOM.

```ts
connected() {
  this.addEventListener('click', this.handleClick);
}
```

::: warning Moving the element
Moving the element from inside `connected()`, such as a toast appending itself to a shared region, disconnects and
reconnects it. `disconnected()` runs, the element initializes again at its new position, and `connected()` is called a
second time. Guard the move: left unguarded, it loops without a pause and freezes the page.

```ts
connected() {
  const region = document.getElementById('toasts')!;
  if (this.parentElement !== region) region.append(this);
}
```
:::

### `disconnected()`

This function is called when the element itself is disconnected from the DOM. Within this function, you can clean up
any event listeners and tasks that were attached in the `connected()` function so that it is free to be garbage
collected.

```ts
disconnected() {
  this.removeEventListener('click', this.handleClick);
}
```

By the time `disconnected()` runs, the element no longer counts as initialized: the `data-impulse-element` attribute is
gone, [`isInitialized(this)`](/utilities/is-initialized) is `false`, and `whenInitialized(this)` waits until the element
is connected and initialized again.

If `disconnected()` or a `[target]Disconnected()` callback throws, the element still finishes tearing down, so it can
initialize again when it reconnects. The first error is rethrown afterwards.

### `[target]Disconnected()`

This function is called when the declared `target` / `targets` is disconnected from the DOM. Within this function, you
can clean up any event listeners and tasks that were attached in the `[target]Connected()` function so that it is
free to be garbage collected.

```ts
@target() panel: HTMLElement;
@targets() buttons: HTMLButtonElement[];

panelDisconnected(panel: HTMLElement) {
  console.log('panel disconnected from the DOM: ', panel);
}

buttonsDisconnected(button: HTMLButtonElement) {
  console.log('button disconnected from the DOM: ', button);
}
```
