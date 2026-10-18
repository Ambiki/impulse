import { bindProperties } from '../property';
import { shareRegistrations } from '../registry';

/**
 * Registers the decorated class as a custom element, so every `<name>` in the document is upgraded to an instance of
 * it. The tag name is also the identifier that `data-target` and `data-action` descriptors are scoped by. The class is
 * additionally exposed on `window` under its class name, for inspecting it from the browser console.
 *
 * What gets registered, and returned, is a subclass of the decorated class that binds each `@property()` once
 * construction is done: the field initializers are the Defaults, and any later assignment, before the element connects
 * or after, is written to the attribute. As a decorator, the class name refers to the subclass. Called as a function,
 * `registerElement(name)(Class)`, only the returned class is registered, so `new Class()` throws.
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
  return <T extends CustomElementConstructor>(ctor: T): T => {
    const registered = class extends ctor {
      constructor(...args: any[]) {
        super(...args);
        // Only once the whole element is constructed. A subclass's field initializers run after this returns, so a
        // registered subclass binds in its own constructor, and one defined without `@registerElement` binds when it
        // first connects.
        if (new.target === registered) bindProperties(this);
      }
    };
    Object.defineProperty(registered, 'name', { value: ctor.name });
    shareRegistrations(ctor.prototype, registered.prototype);

    try {
      window.customElements.define(name, registered);
      // @ts-expect-error Register
      window[ctor.name] = customElements.get(name);
    } catch (error: unknown) {
      if (!(error instanceof DOMException && error.name === 'NotSupportedError')) throw error;
    }
    return registered;
  };
}
