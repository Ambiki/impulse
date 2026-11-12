import type { Lifecycle } from './lifecycle';
import Action from './action';
import { emit } from './events';
import { whenParsed } from './helpers/dom';
import { createLifecycle } from './lifecycle';
import Property, { observedAttributes } from './property';
import Target from './target';

// Built in the class's static block, which can reach the parts the Steps start and stop.
let lifecycle: Lifecycle<ImpulseElement>;

export class ImpulseElement extends HTMLElement {
  /**
   * Set to `true` once you have migrated target connected callbacks to `whenInitialized()` to silence the deprecation
   * warning about the implicit descendant-definition wait. Set it on `ImpulseElement` to opt out globally, or on a
   * specific element class to opt out per class.
   */
  static migratedToWhenInitialized = false;

  private property = new Property(this);
  private target = new Target(this);
  private action = new Action(this);

  static {
    lifecycle = createLifecycle<ImpulseElement>({
      steps: [
        // Properties start before the first wait, so a defined element's properties are live as soon as it connects.
        // Property setup only reads the element's own attributes and Defaults, so it does not need to wait for the
        // document or for descendants (unlike targets and actions, which scan children).
        { start: (element) => element.property.start(), stop: (element) => element.property.stop() },
        // The subtree may be incomplete until the document is Parsed (docs/adr/0003). Once it is, this still yields one
        // microtask, so code that appends an element and then its children finishes before the element initializes.
        { start: () => whenParsed() },
        { start: (element) => customElements.upgrade(element) },
        // Resolve all undefined elements before starting targets so that property references can be resolved to the
        // assigned value.
        // DEPRECATED: this implicit wait will be removed in the next major version. Use `whenInitialized()` inside
        // connected callbacks instead. See `_resolveUndefinedElements`.
        { start: (element) => element._resolveUndefinedElements() },
        // Targets before actions. Each start runs code synchronously: replaying the existing targets invokes
        // `[target]Connected`, and subscribing flushes pending mutations, which runs other elements' callbacks.
        { start: (element) => element.target.start(), stop: (element) => element.target.stop() },
        { start: (element) => element.action.start(), stop: (element) => element.action.stop() },
      ],
      connected: (element) => element.connected(),
      disconnected: (element) => element.disconnected(),
      isHost: (ctor) => ctor === ImpulseElement || ctor.prototype instanceof ImpulseElement,
    });
  }

  connectedCallback() {
    lifecycle.connect(this);
  }

  static get observedAttributes(): string[] {
    return observedAttributes(this);
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (!lifecycle.reportsChanges(this) || oldValue === newValue) return;
    this.property.attributeChanged(name, oldValue, newValue);
  }

  disconnectedCallback() {
    lifecycle.disconnect(this);
  }

  connected() {
    // Override in your subclass to respond when the element is connected to the DOM.
  }

  disconnected() {
    // Override in your subclass to respond when the element is removed from the DOM.
  }

  /**
   * Emits a custom event from the element, prefixed with the element's identifier so listeners can tell one element's
   * events from another's: `this.emit('copied')` on a `<clip-board>` dispatches `clip-board:copied`.
   *
   * Takes the same options as the standalone {@link emit}, plus `prefix` (a different prefix, or `false` for the bare
   * event name) and `target` (what to dispatch from, defaulting to the element).
   */
  emit<T extends Record<string, any>>(
    name: string,
    {
      target = this,
      prefix = this.identifier,
      ...rest
    }: CustomEventInit<T> & { target?: Element | Window | Document; prefix?: boolean | string } = {},
  ): CustomEvent<T> {
    const eventName = prefix ? `${prefix}:${name}` : name;
    return emit(target, eventName, rest);
  }

  get identifier() {
    return this.tagName.toLowerCase();
  }

  private _resolveUndefinedElements() {
    const undefinedElements = Array.from(this.querySelectorAll(':not(:defined)'));
    const migrated = (this.constructor as typeof ImpulseElement).migratedToWhenInitialized;
    if (undefinedElements.length > 0 && !migrated) {
      console.warn(
        `[impulse] <${this.identifier}> waits for descendant custom elements to be defined before invoking target ` +
        `connected callbacks. This is deprecated and will be removed in the next major version. If a connected ` +
        `callback reads properties on a target element, await whenInitialized(target) inside the callback instead. ` +
        `Set ImpulseElement.migratedToWhenInitialized = true to silence this warning.`,
      );
    }
    const promises = undefinedElements.map((element) => customElements.whenDefined(element.localName));
    return Promise.all(promises);
  }
}

/**
 * Returns whether `element` is an Impulse element that is initialized right now: its properties, targets, and actions
 * have started, and it has not been disconnected since. It is `true` from just before `connected()` runs until the
 * element's teardown begins, just before `disconnected()`. A method that can be called at any time can check it before
 * reaching for the element's targets.
 *
 * Standard HTML elements and non-Impulse custom elements never initialize, so they return `false`, even once
 * `whenInitialized` has resolved for them. A `data-impulse-element` attribute that was copied by `cloneNode` or
 * hand-written rather than set by the element itself does not count.
 *
 * @param element - The element to check.
 * @returns `true` if `element` is an initialized Impulse element.
 *
 * @example
 * ```ts
 * show() {
 *   if (!isInitialized(this)) {
 *     // Not wired up yet: `connected()` opens the dialog once it runs.
 *     this.open = true;
 *     return;
 *   }
 *   this.dialog.showModal();
 * }
 * ```
 */
export function isInitialized(element: Element): boolean {
  return lifecycle.isInitialized(element);
}

/**
 * Returns a promise that resolves once the element is ready to be interacted with. For an Impulse element that means
 * once its properties, targets, and actions have started.
 *
 * This mirrors the familiar `customElements.whenDefined()` pattern, but for an Impulse element resolves on full
 * initialization rather than mere definition.
 *
 * - **Standard HTML elements** (a tag name without a hyphen can never be a custom element) resolve immediately —
 *   there is nothing to initialize.
 * - **Impulse custom elements** resolve once they have initialized. A `data-impulse-element` attribute that was copied
 *   by `cloneNode` or hand-written rather than set by the element itself does not count.
 * - **Non-Impulse custom elements** never initialize, so they resolve as soon as their class is defined
 *   (equivalent to `customElements.whenDefined`) — making this safe to use on any target element.
 *
 * By default there is no deadline: like `customElements.whenDefined`, the promise stays pending until the element is
 * ready, so a never-registered (e.g. mistyped) tag never resolves and surfaces as code after the `await` that never
 * runs. Pass `timeout` to reject after a number of milliseconds you choose — an acceptable wait depends on your bundle
 * size and your users' network, which only the application can know, so the library does not guess one for you.
 *
 * @param element - The element to wait for.
 * @param options - Optional settings.
 * @param options.timeout - Milliseconds to wait before rejecting. Omit (or pass `Infinity`) to wait indefinitely.
 * @returns A promise that resolves with the same element once it is ready.
 *
 * @example
 * ```ts
 * const select = await whenInitialized(this.select);
 * select.doSomething();
 *
 * // Bail out after a deadline you choose:
 * const panel = await whenInitialized(this.panel, { timeout: 5000 });
 * ```
 */
export function whenInitialized<T extends Element>(
  element: T,
  { timeout }: { timeout?: number } = {},
): Promise<T> {
  return lifecycle.whenInitialized(element, { timeout });
}
