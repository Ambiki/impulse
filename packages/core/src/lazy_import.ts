import SetMap from './data_structures/set_map';
import { domReady } from './helpers/dom';
import { watchSelector } from './observers/document_observer';

const lazyElements = new SetMap<string, () => void>();

/**
 * Lazy import helps improve the initial loading performance of an application by including them only when the element
 * is present in the DOM.
 *
 * Although HTML classes as selectors are supported, it is recommended to use data attributes such as `data-js-load-billing`.
 *
 * The callback is invoked at most once per selector - the first time a matching element is seen, the registered
 * callbacks fire and the watcher is torn down. For callbacks that should run on every connection (e.g. per-page
 * initialization under Turbo/Hotwire navigation), use {@link connected} instead.
 *
 * @param selector - The selector to match the elements.
 * @param callback - The callback to execute when the element is present in the DOM.
 *
 * @example
 * lazyImport('my-element', () => import('./my_element'));
 * lazyImport('[data-cc-form]', () => import('./billing/credit_card_form'));
 */
export function lazyImport(selector: string, callback: () => void) {
  lazyElements.add(selector, callback);

  const stop = watchSelector(selector, {
    elementConnected() {
      for (const cb of lazyElements.get(selector) || []) {
        domReady().then(cb);
      }
      lazyElements.deleteKey(selector);
      stop();
    },
  });
}
