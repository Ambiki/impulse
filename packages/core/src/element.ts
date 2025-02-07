import Action from './action';
import type { PropertyConstructor, PropertyType } from './decorators/property';
import { domReady } from './helpers/dom';
import { camelize, dasherize, parseJSON } from './helpers/string';
import Property from './property';
import Store from './store';
import Target from './target';

export default class ImpulseElement extends HTMLElement {
  private property = new Property(this);
  private target = new Target(this);
  private action = new Action(this);
  private _started = false;

  async connectedCallback() {
    await domReady();
    customElements.upgrade(this);
    // Order is important
    this.property.start();
    // Resolve all undefined elements before initializing the target/targets so that property references can be resolved
    // to the assigned value.
    await this._resolveUndefinedElements();
    this.target.start();
    this.action.start();
    this._started = true;

    this.setAttribute('data-impulse-element', '');
    this.connected();
  }

  static get observedAttributes(): string[] {
    const store = new Store(this.prototype, 'property');
    return Array.from(store.value as Set<PropertyType>).map(({ key }) => dasherize(key));
  }

  attributeChangedCallback(name: string, _oldValue: string | null, _newValue: string | null) {
    if (!this._started || _oldValue === _newValue) return;

    const camelizedName = camelize(name);
    const fn = (this as Record<string, unknown>)[`${camelizedName}Changed`];
    if (typeof fn !== 'function') return;

    const store = new Store(Object.getPrototypeOf(this), 'property');
    const propertyArray = Array.from(store.value as Set<PropertyType>).map(({ key, type }) => ({ key, type }));
    const property = propertyArray.find(({ key }) => key === camelizedName);
    if (!property) {
      throw new Error(
        `Unregistered attribute changed: ${name}. Register the attribute using the @property() decorator.`
      );
    }

    // Validate if value changed after transformation.
    // Common case would be:
    // -> 8_000 to 8000
    const { newValue, oldValue } = attributeValueTransformer(_newValue, _oldValue, property.type);
    if (newValue === oldValue) return;

    fn.call(this, newValue, oldValue);
  }

  disconnectedCallback() {
    // Order is important
    this.disconnected();
    this.action.stop();
    this.target.stop();
    this.property.stop();
    this._started = false;
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
  emit<T extends Record<string, unknown>>(
    name: string,
    {
      target = this,
      prefix = this.identifier,
      detail = {} as T,
      ...rest
    }: CustomEventInit<T> & { target?: Element | Window | Document; prefix?: boolean | string } = {}
  ): CustomEvent<T> {
    const eventName = prefix ? `${prefix}:${name}` : name;
    const event = new CustomEvent(eventName, { bubbles: true, composed: true, detail, ...rest });
    target.dispatchEvent(event);
    return event;
  }

  get identifier() {
    return this.tagName.toLowerCase();
  }

  private _resolveUndefinedElements() {
    const undefinedElements = Array.from(this.querySelectorAll(':not(:defined)'));
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
