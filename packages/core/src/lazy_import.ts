import SetMap from './data_structures/set_map';
import { invokeReporting } from './helpers/errors';
import { watchSelector } from './observers/document_observer';

const lazyElements = new SetMap<string, () => void>();

/**
 * Lazy import helps improve the initial loading performance of an application by including them only when the element
 * is present in the DOM.
 *
 * Although HTML classes as selectors are supported, it is recommended to use data attributes such as `data-js-load-billing`.
 *
 * The callback is invoked once per selector, the first time a matching element is seen once the document is Parsed, and
 * the watcher is then torn down. A callback that throws is reported like an uncaught error; the others still run. The
 * imported module should not look the element up with `document.querySelector` when it loads: the import resolves
 * asynchronously, so the element may already be gone, and later matches (e.g. after Turbo/Hotwire navigation) would be
 * missed. Have the module register with {@link connected} instead so it sees every matching element.
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

  // Once the document is Parsed, `watchSelector` scans it synchronously, so `elementConnected` can run before `stop` is
  // assigned. During that scan only mark the watcher as stopped; the teardown runs once `watchSelector` has returned.
  let stopped = false;
  let scanning = true;
  const stop = watchSelector(selector, {
    elementConnected() {
      if (stopped) return;
      stopped = true;
      const callbacks = lazyElements.valuesForKey(selector);
      lazyElements.deleteKey(selector);
      for (const cb of callbacks) invokeReporting(cb);
      if (!scanning) stop();
    },
  });
  scanning = false;
  if (stopped) stop();
}
