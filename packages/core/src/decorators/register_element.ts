/**
 * Registers the decorated class as a custom element, so every `<name>` in the document is upgraded to an instance of
 * it. The tag name is also the identifier that `data-target` and `data-action` descriptors are scoped by. The class is
 * additionally exposed on `window` under its class name, for inspecting it from the browser console.
 *
 * Registering a name that is already taken is ignored rather than fatal, so a module evaluated twice (a hot reload,
 * say) leaves the working element alone. Every other failure is rethrown, including the `SyntaxError` for a tag name
 * without a hyphen.
 *
 * @param name - The tag name to register. The custom element spec requires it to contain a hyphen.
 *
 * @example
 * ```ts
 * @registerElement('clip-board')
 * export default class ClipBoardElement extends ImpulseElement {
 *   // ...
 * }
 * ```
 */
export function registerElement(name: string) {
  return (ctor: any) => {
    try {
      window.customElements.define(name, ctor);
      // @ts-expect-error Register
      window[ctor.name] = customElements.get(name);
    } catch (error: unknown) {
      if (!(error instanceof DOMException && error.name === 'NotSupportedError')) throw error;
    }
  };
}
