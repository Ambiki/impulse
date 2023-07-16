import { PropertyConstructor } from './decorators/property';
import Property from './property';

export default class ImpulseElement extends HTMLElement {
  static properties = new Map<string, { type: PropertyConstructor }>();
  private property = new Property(this);

  async connectedCallback() {
    await domReady();
    customElements.upgrade(this);
    this.property.start();
    this.connected();
  }

  disconnectedCallback() {
    this.property.stop();
    this.disconnected();
  }

  connected() {
    // Override in your subclass to respond when the element is connected to the DOM.
  }

  disconnected() {
    // Override in your subclass to respond when the element is removed from the DOM.
  }

  static addProperty(name: string, { type = String }: { type?: PropertyConstructor } = {}) {
    this.properties.set(name, { type });
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
