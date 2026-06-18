import type { Watcher } from './observers/document_observer';
import { IMPULSE_ELEMENT_ATTRIBUTE } from './constants';
import { watchSelector } from './observers/document_observer';

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
  const cleanups = new WeakMap<T, void | (() => void)>();
  const watcher: Watcher<T> = {
    elementConnected: (element) => {
      const cleanup = callback(element);
      if (cleanup) {
        cleanups.set(element, cleanup);
      }
    },
    elementDisconnected: (element) => {
      const cleanup = cleanups.get(element);
      if (cleanup) {
        cleanup();
        cleanups.delete(element);
      }
    },
  };
  return watchSelector<T>(selector, watcher);
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
  callback: (element: HTMLElementTagNameMap[K]) => void,
): () => void;
export function disconnected<T extends Element = Element>(selector: string, callback: (element: T) => void): () => void;
export function disconnected<T extends Element = Element>(selector: string, callback: (element: T) => void) {
  return watchSelector<T>(selector, { elementDisconnected: callback });
}

/**
 * Returns a promise that resolves once the element has been fully initialized by Impulse, i.e. once its properties,
 * targets, and actions have started and the `data-impulse-element` marker attribute has been set.
 *
 * This mirrors the familiar `customElements.whenDefined()` pattern, but resolves on full initialization rather than
 * mere definition. If the element is already initialized, the returned promise resolves on the next microtask. The
 * promise stays pending until the element initializes, so calling it on an element that never becomes an
 * `ImpulseElement` never resolves.
 *
 * @param element - The element to wait for.
 * @returns A promise that resolves with the same element once it is initialized.
 *
 * @example
 * ```ts
 * const select = await whenInitialized(this.selectTarget);
 * select.doSomething();
 * ```
 */
export function whenInitialized<T extends Element>(element: T): Promise<T> {
  if (element.hasAttribute(IMPULSE_ELEMENT_ATTRIBUTE)) {
    return Promise.resolve(element);
  }

  return new Promise<T>((resolve) => {
    // `connected` fires when an element starts matching the selector, including when the marker attribute is added
    // later by `_asyncConnect`. We filter to our specific element and stop watching as soon as it initializes.
    const stop = connected<T>(`[${IMPULSE_ELEMENT_ATTRIBUTE}]`, (el) => {
      if (el !== element) return;
      stop();
      resolve(element);
    });
  });
}
