import type { SelectorObserverDelegate } from './observers/selector_observer';
import { SelectorObserver } from './observers/selector_observer';

/**
 * Observes the DOM and invokes a callback whenever elements matching the selector are added to the DOM.
 *
 * This function sets up a MutationObserver on the document that watches for elements matching
 * the provided CSS selector. The callback is invoked immediately for any matching elements
 * already in the DOM, and then for any elements added later.
 *
 * @param selector - CSS selector to match elements against
 * @param callback - Function to invoke when a matching element is mounted. Can optionally return
 *                   a cleanup function that will be called when the element is disconnected.
 * @returns A cleanup function that stops observing
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
  callback: (element: HTMLElementTagNameMap[K]) => void | (() => void)
): () => void;
export function connected<T extends Element = Element>(
  selector: string,
  callback: (element: T) => void | (() => void)
): () => void;
export function connected<T extends Element = Element>(
  selector: string,
  callback: (element: T) => void | (() => void)
) {
  let cleanup: void | (() => void);
  const delegate: SelectorObserverDelegate<T> = {
    elementConnected: (element) => {
      cleanup = callback(element);
    },
    elementDisconnected: () => {
      if (cleanup) {
        cleanup();
        cleanup = undefined;
      }
    },
  };
  const observer = new SelectorObserver(document.documentElement, selector, delegate);
  observer.start();

  return () => {
    observer.stop();
  };
}

/**
 * Observes the DOM and invokes a callback whenever elements matching the selector are removed from the DOM.
 *
 * This function sets up a MutationObserver on the document that watches for elements matching
 * the provided CSS selector being disconnected. The callback is invoked when matching elements
 * are removed from the DOM or when their attributes change such that they no longer match the selector.
 *
 * @param selector - CSS selector to match elements against
 * @param callback - Function to invoke when a matching element is disconnected
 * @returns A cleanup function that stops observing
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
  callback: (element: HTMLElementTagNameMap[K]) => void
): () => void;
export function disconnected<T extends Element = Element>(selector: string, callback: (element: T) => void): () => void;
export function disconnected<T extends Element = Element>(selector: string, callback: (element: T) => void) {
  const delegate: SelectorObserverDelegate<T> = {
    elementDisconnected: callback,
  };
  const observer = new SelectorObserver(document.documentElement, selector, delegate);
  observer.start();

  return () => {
    observer.stop();
  };
}
