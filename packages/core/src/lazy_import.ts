import SetMap from './data_structures/set_map';
import { domReady } from './helpers/dom';
import ElementObserver from './observers/element_observer';

const lazyElements = new SetMap<string, () => void>();
const animationFrameTimers = new WeakMap<Element | Document, number>();

class ElementObserverDelegate {
  elementConnected(element: Element | Document) {
    cancelAnimationFrame(animationFrameTimers.get(element) || 0);
    animationFrameTimers.set(
      element,
      requestAnimationFrame(() => this.importElementsFrom(element))
    );
  }

  elementDisconnected() {}

  elementAttributeChanged() {}

  private importElementsFrom(element: Element | Document) {
    for (const selector of lazyElements.keys) {
      const target = element.querySelector(selector);
      if (target) {
        for (const callback of lazyElements.get(selector) || []) {
          domReady().then(callback);
          lazyElements.deleteKey(selector);
          animationFrameTimers.delete(element);
        }
      }
    }
  }
}

export default function lazyImport(selector: string, callback: () => void) {
  lazyElements.add(selector, callback);

  const delegate = new ElementObserverDelegate();
  const observer = new ElementObserver(document, delegate);
  delegate.elementConnected(document);
  observer.start();
}
