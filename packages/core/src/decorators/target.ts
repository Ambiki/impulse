import Store from '../store';

/**
 * A single `@target()` / `@targets()` registration: the field name, and whether it collects every matching element or
 * only one.
 */
export interface TargetType {
  key: string;
  multiple: boolean;
}

/**
 * Binds a field to the descendant carrying `data-target="<tag-name>.<field>"`, or `null` while none is present. The
 * binding is live rather than a one-off `querySelector()`, and a `[field]Connected(element)` or
 * `[field]Disconnected(element)` method is invoked as the target comes and goes.
 *
 * A token belongs to the closest ancestor (or the element itself) matching its identifier, so nested elements of the
 * same tag do not claim each other's targets. A second element claiming a single-target key throws, pointing at
 * {@link targets} instead.
 *
 * @example
 * ```ts
 * @registerElement('greet-user')
 * export default class GreetUserElement extends ImpulseElement {
 *   @target() result: HTMLElement;
 *
 *   resultConnected(result: HTMLElement) {
 *     // ...
 *   }
 * }
 * ```
 *
 * ```html
 * <greet-user>
 *   <div data-target="greet-user.result"></div>
 * </greet-user>
 * ```
 */
export function target() {
  return (ctor: any, key: string) => {
    const store = new Store<TargetType>(ctor, 'target');
    store.add({ key, multiple: false });
  };
}

/**
 * The multiple-element form of {@link target}: the field is every matching descendant in document order, and an empty
 * array while there are none. Ownership and the connected/disconnected callbacks work as they do for a single target.
 *
 * @example
 * ```ts
 * @registerElement('greet-user')
 * export default class GreetUserElement extends ImpulseElement {
 *   @targets() results: HTMLElement[];
 * }
 * ```
 *
 * ```html
 * <greet-user>
 *   <div data-target="greet-user.results"></div>
 *   <div data-target="greet-user.results"></div>
 * </greet-user>
 * ```
 */
export function targets() {
  return (ctor: any, key: string) => {
    const store = new Store<TargetType>(ctor, 'target');
    store.add({ key, multiple: true });
  };
}
