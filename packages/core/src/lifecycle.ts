import { getMatchingElementsFrom } from './helpers/dom';
import { ElementObserver, type ElementObserverDelegate } from './observers/element_observer';

export interface ConnectedOptions extends Omit<MutationObserverInit, 'childList' | 'subtree'> {}

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
 * @param options - Optional configuration
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
 * // Does not invoke if `widget` is dynamically added to an element
 * connected('.widget', (element) => {
 *   initializeWidget(element);
 * }, { attributes: false });
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
  options?: ConnectedOptions
): () => void;
export function connected<T extends Element = Element>(
  selector: string,
  callback: (element: T) => void | (() => void),
  options?: ConnectedOptions
): () => void;
export function connected<T extends Element = Element>(
  selector: string,
  callback: (element: T) => void | (() => void),
  options: ConnectedOptions = {}
) {
  let cleanup: void | (() => void);
  const delegate: ElementObserverDelegate<T> = {
    elementConnected: (element) => {
      cleanup = callback(element);
    },
    elementDisconnected: () => {
      if (cleanup) {
        cleanup();
      }
    },
    getMatchingElements: (element) => getMatchingElementsFrom<T>(element, selector),
  };
  const observer = new ElementObserver(document.documentElement, delegate, {
    attributes: true,
    ...options,
  });
  observer.start();

  return () => {
    observer.stop();
  };
}

interface DisconnectedOptions extends Omit<MutationObserverInit, 'childList' | 'subtree'> {}

/**
 * Observes the DOM and invokes a callback whenever elements matching the selector are removed from the DOM.
 *
 * This function sets up a MutationObserver on the document that watches for elements matching
 * the provided CSS selector being disconnected. The callback is invoked when matching elements
 * are removed from the DOM or when their attributes change such that they no longer match the selector.
 *
 * @param selector - CSS selector to match elements against
 * @param callback - Function to invoke when a matching element is disconnected
 * @param options - Optional configuration
 * @returns A cleanup function that stops observing
 *
 * @example
 * ```ts
 * // Watch for buttons being removed from the DOM
 * disconnected('button', (element) => {
 *   console.log('Button removed: ', element);
 * });
 *
 * // Does not invoke if `widget` class is removed (only when element itself is removed)
 * disconnected('.widget', (element) => {
 *   cleanupWidget(element);
 * }, { attributes: false });
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
  options?: DisconnectedOptions
): () => void;
export function disconnected<T extends Element = Element>(
  selector: string,
  callback: (element: T) => void,
  options?: DisconnectedOptions
): () => void;
export function disconnected<T extends Element = Element>(
  selector: string,
  callback: (element: T) => void,
  options: DisconnectedOptions = {}
) {
  const delegate: ElementObserverDelegate<T> = {
    elementDisconnected: callback,
    getMatchingElements: (element) => getMatchingElementsFrom<T>(element, selector),
  };
  const observer = new ElementObserver(document.documentElement, delegate, {
    attributes: true,
    ...options,
  });
  observer.start();

  return () => {
    observer.stop();
  };
}
