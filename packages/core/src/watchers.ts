import { invokeEach } from './helpers/invoke_each';
import { watchSelector } from './observers/document_observer';

/**
 * Observes the DOM and invokes a callback whenever elements matching the selector are added to the DOM.
 *
 * This function sets up a MutationObserver on the document that watches for elements matching
 * the provided CSS selector. The callback is invoked for any matching elements already in the DOM,
 * then for any elements added later, and for any element whose attributes change such that it
 * starts matching the selector.
 *
 * Nothing is matched before the document is Parsed: while `document.readyState` is `loading`, an element can be in the
 * document before its children are. Once the document is Parsed, elements already in the DOM are matched before this
 * function returns; called from a blocking `<head>` script, the callback first runs on `DOMContentLoaded`, for every
 * matching element in the finished document.
 *
 * @param selector - CSS selector to match elements against
 * @param callback - Function to invoke when a matching element is mounted. Can optionally return
 *                   a cleanup function that will be called when the element is disconnected. If it
 *                   throws, the error is reported like an uncaught error and other watchers still run.
 * @returns A cleanup function that stops observing and runs the pending cleanup of every element still connected
 * @throws A `SyntaxError`, with nothing registered, for a selector the browser rejects.
 *
 * @example
 * ```ts
 * // Watch for all buttons being added to the DOM
 * connected('button', (element) => {
 *   console.log('Button mounted: ', element);
 * });
 *
 * // With cleanup function
 * connected('.dynamic-content', (element) => {
 *   console.log('Element connected: ', element);
 *   return () => {
 *     console.log('Element disconnected: ', element);
 *   };
 * });
 *
 * // Stop manually
 * const stop = connected('div', (element) => {
 *   console.log('Connected');
 * });
 * stop();
 * ```
 */
export function connected<K extends keyof HTMLElementTagNameMap>(
  selector: K,
  callback: (element: HTMLElementTagNameMap[K]) => void | (() => void),
): () => void;
export function connected<T extends Element = Element>(
  selector: string,
  callback: (element: T) => void | (() => void),
): () => void;
export function connected<T extends Element = Element>(
  selector: string,
  callback: (element: T) => void | (() => void),
) {
  const cleanups = new Map<T, () => void>();
  const stopWatching = watchSelector<T>(selector, {
    elementConnected: (element) => {
      const cleanup = callback(element);
      if (cleanup) {
        cleanups.set(element, cleanup);
      }
    },
    elementDisconnected: (element) => {
      const cleanup = cleanups.get(element);
      if (cleanup) {
        cleanups.delete(element);
        cleanup();
      }
    },
  });

  return () => {
    // Elements still in the DOM will never be disconnected through this watcher, so their cleanups would leak. The map
    // is cleared before any cleanup runs so a cleanup that calls stop() again finds nothing left to do. Every cleanup
    // runs and the watcher is deregistered even if one throws; the first error is rethrown once that is done.
    const pending = Array.from(cleanups.values());
    cleanups.clear();
    try {
      invokeEach(pending, (cleanup) => cleanup());
    } finally {
      stopWatching();
    }
  };
}

/**
 * Observes the DOM and invokes a callback whenever elements matching the selector are removed from the DOM.
 *
 * This function sets up a MutationObserver on the document that watches for elements matching
 * the provided CSS selector being disconnected. The callback is invoked when matching elements
 * are removed from the DOM or when their attributes change such that they no longer match the selector.
 *
 * Like {@link connected}, it matches nothing before the document is Parsed, so an element inserted and removed while
 * `document.readyState` is `loading` is never reported.
 *
 * @param selector - CSS selector to match elements against
 * @param callback - Function to invoke when a matching element is disconnected
 * @returns A cleanup function that stops observing
 * @throws A `SyntaxError`, with nothing registered, for a selector the browser rejects.
 *
 * @example
 * ```ts
 * // Watch for buttons being removed from the DOM
 * disconnected('button', (element) => {
 *   console.log('Button removed: ', element);
 * });
 *
 * // Stop manually
 * const stop = disconnected('button', (element) => {
 *   console.log('Connected');
 * });
 * stop();
 * ```
 */
export function disconnected<K extends keyof HTMLElementTagNameMap>(
  selector: K,
  callback: (element: HTMLElementTagNameMap[K]) => void,
): () => void;
export function disconnected<T extends Element = Element>(selector: string, callback: (element: T) => void): () => void;
export function disconnected<T extends Element = Element>(selector: string, callback: (element: T) => void) {
  return watchSelector<T>(selector, { elementDisconnected: callback });
}
