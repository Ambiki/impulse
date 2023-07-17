import { PropertyConstructor } from './decorators/property';
import { camelize, dasherize } from './helpers/string';
import Property from './property';
import Target from './target';
import Targets from './targets';

export default class ImpulseElement extends HTMLElement {
  static properties = new Map<string, { type: PropertyConstructor }>();
  static targetsKeys = new Set<string>();
  static targetKeys = new Set<string>();

  private property = new Property(this);
  private targets = new Targets(this);
  private target = new Target(this);
  private _started = false;

  async connectedCallback() {
    await domReady();
    customElements.upgrade(this);
    // Order is important
    this.property.start();
    // Resolve all undefined elements before initializing the target/targets so that property references can be resolved
    // to the assigned value.
    await this._resolveUndefinedElements();
    this.targets.start();
    this.target.start();
    this._started = true;

    this.setAttribute('data-impulse-element', '');
    this.connected();
  }

  static get observedAttributes(): string[] {
    return Array.from(this.properties.keys()).map((key) => dasherize(key));
  }

  attributeChangedCallback(name: string, _oldValue: string | null, _newValue: string | null) {
    if (!this._started || _oldValue === _newValue) return;

    const camelizedName = camelize(name);
    const fn = (this as Record<string, unknown>)[`${camelizedName}Changed`];
    if (typeof fn !== 'function') return;

    const { properties } = Object.getPrototypeOf(this).constructor as typeof ImpulseElement;
    const property = properties.get(camelizedName);
    if (!property) {
      throw new Error(
        `Unregistered attribute changed: ${name}. Register the attribute using the @property() decorator.`
      );
    }

    const { newValue, oldValue } = attributeValueTransformer(_newValue, _oldValue, property.type);
    fn.call(this, newValue, oldValue);
  }

  disconnectedCallback() {
    // Order is important
    this.target.stop();
    this.targets.stop();
    this.property.stop();
    this.disconnected();
    this._started = false;
  }

  connected() {
    // Override in your subclass to respond when the element is connected to the DOM.
  }

  disconnected() {
    // Override in your subclass to respond when the element is removed from the DOM.
  }

  static addProperty(name: string, { type }: { type: PropertyConstructor }) {
    this.properties.set(name, { type });
  }

  static registerTargets(name: string) {
    this.targetsKeys.add(name);
  }

  static registerTarget(name: string) {
    this.targetKeys.add(name);
  }

  get identifier() {
    return this.tagName.toLowerCase();
  }

  private async _resolveUndefinedElements() {
    const undefinedElements = Array.from(this.querySelectorAll(':not(:defined)'));
    const promises = undefinedElements.map((element) => customElements.whenDefined(element.localName));
    await Promise.all(promises);
  }
}

function attributeValueTransformer(_newValue: string | null, _oldValue: string | null, type: PropertyConstructor) {
  switch (type) {
    case Boolean: {
      const transform = (value: string | null) => value !== null && value !== 'false';
      return { newValue: transform(_newValue), oldValue: transform(_oldValue) };
    }
    case Number:
      return { newValue: Number(_newValue), oldValue: Number(_oldValue) };
    default:
      return { newValue: _newValue, oldValue: _oldValue };
  }
}

function domReady() {
  return new Promise<void>((resolve) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => resolve());
    } else {
      resolve();
    }
  });
}
