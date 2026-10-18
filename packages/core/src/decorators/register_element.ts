import { recordDefaults } from '../property';
import { shareRegistrations } from '../registry';

/**
 * Registers the decorated class as a custom element, so every `<name>` in the document is upgraded to an instance of
 * it. The tag name is also the identifier that `data-target` and `data-action` descriptors are scoped by. The class is
 * additionally exposed on `window` under its class name, for inspecting it from the browser console.
 *
 * What gets registered, and returned, is a subclass of the decorated class that records each `@property()` Default
 * once construction is done. A value assigned before the element connects can then be told from its Default, and is
 * written to the attribute like any assignment. As a decorator, the class name refers to the subclass. Called as a
 * function, `registerElement(name)(Class)`, only the returned class is registered, so `new Class()` throws.
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
  return (ctor: CustomElementConstructor): any => {
    const registered = class extends ctor {
      constructor() {
        super();
        recordDefaults(this);
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
