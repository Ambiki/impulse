import { getMatchingElementsFrom } from './helpers/dom';
import { ElementObserver, type ElementObserverDelegate } from './observers/element_observer';

export interface OnConnectedOptions extends Omit<MutationObserverInit, 'childList' | 'subtree'> {}

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
 *
 * @example
 * ```ts
 * // Watch for all buttons being added to the DOM
 * onConnected('button', (element) => {
 *   console.log('Button mounted: ', element);
 * });
 *
 * // With cleanup function
 * onConnected('.dynamic-content', (element) => {
 *   console.log('Element connected: ', element);
 *   return () => {
 *     console.log('Element disconnected: ', element);
 *   };
 * });
 *
 * // Does not invoke if `widget` is dynamically added to an element
 * onConnected('.widget', (element) => {
 *   initializeWidget(element);
 * }, { attributes: false });
 * ```
 */
export function onConnected(
  selector: string,
  callback: (element: Element) => void | (() => void),
  options: OnConnectedOptions = {}
) {
  let cleanup: void | (() => void);
  const delegate: ElementObserverDelegate = {
    elementConnected: (element) => {
      cleanup = callback(element);
    },
    elementDisconnected: () => {
      if (cleanup) {
        cleanup();
      }
    },
    getMatchingElements: (element) => getMatchingElementsFrom(element, selector),
  };
  const observer = new ElementObserver(document.documentElement, delegate, { attributes: true, ...options });
  observer.start();
}

interface OnDisconnectedOptions extends Omit<MutationObserverInit, 'childList' | 'subtree'> {}

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
 *
 * @example
 * ```ts
 * // Watch for buttons being removed from the DOM
 * onDisconnected('button', (element) => {
 *   console.log('Button removed: ', element);
 * });
 *
 * // Does not invoke if `widget` class is removed (only when element itself is removed)
 * onDisconnected('.widget', (element) => {
 *   cleanupWidget(element);
 * }, { attributes: false });
 * ```
 */
export function onDisconnected(
  selector: string,
  callback: (element: Element) => void,
  options: OnDisconnectedOptions = {}
) {
  const delegate: ElementObserverDelegate = {
    elementDisconnected: callback,
    getMatchingElements: (element) => getMatchingElementsFrom(element, selector),
  };
  const observer = new ElementObserver(document.documentElement, delegate, { attributes: true, ...options });
  observer.start();
}
