import SetMap from './data_structures/set_map';
import { domReady } from './helpers/dom';
import ElementObserver from './observers/element_observer';

const lazyElements = new SetMap<string, () => void>();

/**
 * Lazy import helps improve the initial loading performance of an application by including them only when the element
 * is present in the DOM.
 *
 * Although HTML classes as selectors are supported, it is recommended to use data attributes such as `data-js-load-billing`.
 *
 * @param selector - The selector to match the elements.
 * @param callback - The callback to execute when the element is present in the DOM.
 *
 * @example
 * lazyImport('my-element', () => import('./my_element'));
 * lazyImport('[data-cc-form]', () => import('./billing/credit_card_form'));
 */
export default function lazyImport(selector: string, callback: () => void) {
  lazyElements.add(selector, callback);

  const observer = new ElementObserver(document.documentElement, {
    elementConnected() {
      for (const selector of lazyElements.keys) {
        for (const callback of lazyElements.get(selector) || []) {
          domReady().then(callback);
          lazyElements.deleteKey(selector);
        }
      }
    },
    getMatchingElements(element) {
      const elements = Array.from(element.querySelectorAll(selector));
      if (element.matches(selector)) {
        elements.unshift(element);
      }
      return elements;
    },
  });

  observer.start();
}
