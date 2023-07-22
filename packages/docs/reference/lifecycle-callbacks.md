# Lifecycle callbacks

Special functions known as "lifecycle callbacks" allow you to respond whenever an element or target is added or removed
from the DOM.

## Functions

| Function name                        | Invoked                                                                                          |
| ----------------                     | -----------------                                                                                |
| constructor()                        | When the element is first instantiated.                                                          |
| [name]Connected(element: Element)    | When the target is connected to the DOM.                                                         |
| connected()                          | When the element is first connected to the DOM. You can manipulate the DOM within this function. |
| [name]Disconnected(element: Element) | When the target is removed from the DOM.                                                         |
| disconnected()                       | When the element is removed from the DOM. Use this function to remove any event listeners.       |

## Note

When using the `constructor` function, always call `super()`.

```ts
constructor() {
  super()
  // ...
}
```
