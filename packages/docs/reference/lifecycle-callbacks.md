# Lifecycle callbacks

Special functions known as "lifecycle callbacks" allow you to respond whenever an element or target is connected or
disconnected from the DOM.

## Functions

These functions are invoked in order as defined below.

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
manipulate the target, and the most common of these is setting HTML attributes, and adding event listeners. Anything
done within this function should be undone when the target is disconnected from the DOM.

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

### `connected()`

This function is called when the element itself is connected to the DOM. When this function is invoked, you can be sure
that all properties and targets have been resolved and added to the DOM. You can query the DOM within this function,
set event listeners, and do much more. Anything done within this function should be undone when the element is
disconnected from the DOM.

```ts
connected() {
  this.addEventListener('click', this.handleClick);
}
```

### `disconnected()`

This function is called when the element itself is disconnected from the DOM. Within this function, you can clean up
any event listeners and tasks that were attached in the `connected()` function so that it is free to be garbage
collected.

```ts
disconnected() {
  this.removeEventListener('click', this.handleClick);
}
```

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
