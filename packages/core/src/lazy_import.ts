import SetMap from './data_structures/set_map';
import { domReady } from './helpers/dom';
import ElementObserver from './observers/element_observer';

const lazyElements = new SetMap<string, () => void>();
const animationFrameTimers = new WeakMap<Element, number>();

class ElementObserverDelegate {
  elementConnected(element: Element) {
    cancelAnimationFrame(animationFrameTimers.get(element) || 0);
    animationFrameTimers.set(
      element,
      requestAnimationFrame(() => this.importElementsFrom(element))
    );
  }

  private importElementsFrom(element: Element) {
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
  const observer = new ElementObserver(document.documentElement, delegate);
  observer.start();
}
