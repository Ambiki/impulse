import Action from './action';
import { IMPULSE_ELEMENT_ATTRIBUTE } from './constants';
import { emit } from './events';
import { whenParsed } from './helpers/dom';
import { isUnchanged } from './helpers/equality';
import { invokeEach } from './helpers/invoke_each';
import { camelize, dasherize } from './helpers/string';
import { clearInitialized, notifyInitialized } from './initialization';
import Property, { fromAttribute } from './property';
import { PROPERTIES, registered } from './registry';
import Target from './target';

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
  private _started = false;
  // The token of the `_asyncConnect` call that is still initializing, or `null` when none is.
  private _pendingInit: object | null = null;

  connectedCallback() {
    // A reconnect while an init is still pending must not start a second one; the pending init re-checks
    // `isConnected` after each await and finishes on its own.
    if (this._started || this._pendingInit) return;
    this._asyncConnect();
  }

  static get observedAttributes(): string[] {
    return Array.from(registered(this.prototype, PROPERTIES).keys(), dasherize);
  }

  attributeChangedCallback(name: string, _oldValue: string | null, _newValue: string | null) {
    if (!this._started || _oldValue === _newValue) return;

    const camelizedName = camelize(name);
    const fn = (this as Record<string, unknown>)[`${camelizedName}Changed`];
    if (typeof fn !== 'function') return;

    const property = this.property.declarations.get(camelizedName);
    if (!property) {
      throw new Error(
        `Unregistered attribute changed: ${name}. Register the attribute using the @property() decorator.`,
      );
    }

    // Validate if value changed after transformation.
    // Common case would be:
    // -> 8_000 to 8000
    const newValue = fromAttribute(_newValue, property.type);
    const oldValue = fromAttribute(_oldValue, property.type);
    if (isUnchanged(newValue, oldValue, property.type)) return;

    fn.call(this, newValue, oldValue);
  }

  disconnectedCallback() {
    if (!this._started) return;

    // Order is important. Every step runs even if an earlier one throws, so a throwing `disconnected()` cannot leave
    // the watchers registered or the element unable to re-initialize; the first error is rethrown once the element is
    // fully torn down.
    const steps = [
      () => this.disconnected(),
      () => this.action.stop(),
      () => this.target.stop(),
      () => this.property.stop(),
    ];
    try {
      invokeEach(steps, (step) => step());
    } finally {
      this._started = false;
      this.removeAttribute(IMPULSE_ELEMENT_ATTRIBUTE);
      clearInitialized(this);
    }
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

  private async _asyncConnect() {
    // `_pendingInit` is cleared inside this method (before `connected()`, and in the `finally` on every other exit)
    // rather than from a `.finally()` on its promise so it clears synchronously; a reconnect in the next microtask must
    // see it cleared and start a fresh init. Each call clears only its own token: a move inside `connected()` starts a
    // new init that is still pending when this one returns, and clearing that one would let a further reconnect start
    // a second init alongside it.
    const token = {};
    this._pendingInit = token;
    try {
      // Define property accessors synchronously, before yielding to `whenParsed`, so a defined element's properties are
      // live as soon as it connects. Property setup only reads the element's own attributes/defaults, so it does not
      // need to wait for the document or for descendants (unlike `target`/`action`, which scan children).
      this.property.start();
      await whenParsed();
      // Removed while waiting: no watcher has been registered yet, so there is nothing to tear down and a later
      // reconnect starts over. The same applies after the second await below.
      if (!this.isConnected) return;
      customElements.upgrade(this);
      // Resolve all undefined elements before initializing the target/targets so that property references can be
      // resolved to the assigned value.
      // DEPRECATED: this implicit wait will be removed in the next major version. Use `whenInitialized()` inside
      // connected callbacks instead. See `_resolveUndefinedElements`.
      await this._resolveUndefinedElements();
      // Removed while waiting for descendants to be defined.
      if (!this.isConnected) return;
      // Order is important: targets must be wired up before actions.
      this.target.start();
      this.action.start();
      this._started = true;
      // Nothing is pending once targets and actions have started, so a move inside `connected()` below takes the
      // normal disconnect and reconnect path: `disconnected()`, then a fresh init at the new position. Still pending,
      // the reconnect would be dropped and the element left in the DOM torn down.
      this._pendingInit = null;

      this.setAttribute(IMPULSE_ELEMENT_ATTRIBUTE, '');
      // Before `connected()`, so the marker being set and the waiters being resolved are one step: a `connected()`
      // that throws, or that removes the element, cannot leave a `whenInitialized()` call waiting forever.
      notifyInitialized(this);
      this.connected();
    } finally {
      if (this._pendingInit === token) this._pendingInit = null;
    }
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
