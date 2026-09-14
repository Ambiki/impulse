import type { PropertyType } from './decorators/property';
import Action from './action';
import { IMPULSE_ELEMENT_ATTRIBUTE } from './constants';
import { emit } from './events';
import { domReady } from './helpers/dom';
import { invokeEach } from './helpers/invoke_each';
import { camelize, dasherize } from './helpers/string';
import Property, { fromAttribute, isUnchanged } from './property';
import Store from './store';
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
  private _connecting = false;

  connectedCallback() {
    // A reconnect while an init is still pending must not start a second one; the pending init re-checks
    // `isConnected` after each await and finishes on its own.
    if (this._started || this._connecting) return;
    this._asyncConnect();
  }

  static get observedAttributes(): string[] {
    const store = new Store<PropertyType>(this.prototype, 'property');
    return Array.from(store.value ?? []).map(({ key }) => dasherize(key));
  }

  attributeChangedCallback(name: string, _oldValue: string | null, _newValue: string | null) {
    if (!this._started || _oldValue === _newValue) return;

    const camelizedName = camelize(name);
    const fn = (this as Record<string, unknown>)[`${camelizedName}Changed`];
    if (typeof fn !== 'function') return;

    const store = new Store<PropertyType>(Object.getPrototypeOf(this), 'property');
    const propertyArray = Array.from(store.value ?? []).map(({ key, type }) => ({ key, type }));
    const property = propertyArray.find(({ key }) => key === camelizedName);
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
    }
  }

  connected() {
    // Override in your subclass to respond when the element is connected to the DOM.
  }

  disconnected() {
    // Override in your subclass to respond when the element is removed from the DOM.
  }

  /**
   * Emits a custom event from the element.
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
    // `_connecting` is cleared in the `finally` of this method rather than from a `.finally()` on its promise so it
    // clears synchronously on every exit; a reconnect in the next microtask must see it cleared and start a fresh init.
    this._connecting = true;
    try {
      // Define property accessors synchronously, before yielding to `domReady`, so a defined element's properties are
      // live as soon as it connects. Property setup only reads the element's own attributes/defaults, so it does not
      // need to wait for the document or for descendants (unlike `target`/`action`, which scan children).
      this.property.start();
      await domReady();
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

      this.setAttribute(IMPULSE_ELEMENT_ATTRIBUTE, '');
      this.connected();
    } finally {
      this._connecting = false;
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
