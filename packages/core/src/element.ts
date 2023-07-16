import { PropertyConstructor } from './decorators/property';
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
    this.connected();
  }

  disconnectedCallback() {
    // Order is important
    this.target.stop();
    this.targets.stop();
    this.property.stop();
    this.disconnected();
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

function domReady() {
  return new Promise<void>((resolve) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => resolve());
    } else {
      resolve();
    }
  });
}
