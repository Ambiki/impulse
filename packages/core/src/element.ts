import type { PropertyConstructor, PropertyType } from './decorators/property';
import Action from './action';
import { IMPULSE_ELEMENT_ATTRIBUTE } from './constants';
import { emit } from './events';
import { domReady } from './helpers/dom';
import { camelize, dasherize, parseJSON } from './helpers/string';
import Property from './property';
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

  connectedCallback() {
    if (!this._started) {
      this._asyncConnect();
    }
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
    const { newValue, oldValue } = attributeValueTransformer(_newValue, _oldValue, property.type);
    // `Object.is` rather than `===` so a Number that transforms to `NaN` on both sides (e.g. a
    // non-numeric value replaced with another) is treated as unchanged and does not fire the callback.
    if (Object.is(newValue, oldValue)) return;

    fn.call(this, newValue, oldValue);
  }

  disconnectedCallback() {
    if (this._started) {
      // Order is important
      this.disconnected();
      this.action.stop();
      this.target.stop();
      this.property.stop();
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
    await domReady();
    customElements.upgrade(this);
    // Order is important
    this.property.start();
    // Resolve all undefined elements before initializing the target/targets so that property references can be resolved
    // to the assigned value.
    // DEPRECATED: this implicit wait will be removed in the next major version. Use `whenInitialized()` inside connected
    // callbacks instead. See `_resolveUndefinedElements`.
    await this._resolveUndefinedElements();
    this.target.start();
    this.action.start();
    this._started = true;

    this.setAttribute(IMPULSE_ELEMENT_ATTRIBUTE, '');
    this.connected();
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

function attributeValueTransformer(_newValue: string | null, _oldValue: string | null, type: PropertyConstructor) {
  switch (type) {
    case Boolean: {
      const transform = (value: string | null) => value !== null && value !== 'false';
      return { newValue: transform(_newValue), oldValue: transform(_oldValue) };
    }
    case Number: {
      const transform = (value: string | null) => value?.replace(/_/g, '');
      return { newValue: Number(transform(_newValue)), oldValue: Number(transform(_oldValue)) };
    }
    case Array:
      return { newValue: parseJSON(_newValue, []), oldValue: parseJSON(_oldValue, []) };
    case Object:
      return { newValue: parseJSON(_newValue, {}), oldValue: parseJSON(_oldValue, {}) };
    default:
      return { newValue: _newValue, oldValue: _oldValue };
  }
}
