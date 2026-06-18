import type { Watcher } from './observers/document_observer';
import { IMPULSE_ELEMENT_ATTRIBUTE } from './constants';
import { ImpulseElement } from './element';
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
 * Returns a promise that resolves once the element is ready to be interacted with. For an Impulse element that means
 * once its properties, targets, and actions have started and the `data-impulse-element` marker attribute has been set.
 *
 * This mirrors the familiar `customElements.whenDefined()` pattern, but for an Impulse element resolves on full
 * initialization rather than mere definition.
 *
 * - **Standard HTML elements** (a tag name without a hyphen can never be a custom element) resolve immediately —
 *   there is nothing to initialize.
 * - **Impulse custom elements** resolve once the `data-impulse-element` marker attribute is set.
 * - **Non-Impulse custom elements** never receive the marker, so they resolve as soon as their class is defined
 *   (equivalent to `customElements.whenDefined`) — making this safe to use on any target element.
 *
 * By default there is no deadline: like `customElements.whenDefined`, the promise stays pending until the element is
 * ready, so a never-registered (e.g. mistyped) tag never resolves and surfaces as code after the `await` that never
 * runs. Pass `timeout` to reject after a number of milliseconds you choose — an acceptable wait depends on your bundle
 * size and your users' network, which only the application can know, so the library does not guess one for you.
 *
 * @param element - The element to wait for.
 * @param options - Optional settings.
 * @param options.timeout - Milliseconds to wait before rejecting. Omit (or pass `Infinity`) to wait indefinitely.
 * @returns A promise that resolves with the same element once it is ready.
 *
 * @example
 * ```ts
 * const select = await whenInitialized(this.selectTarget);
 * select.doSomething();
 *
 * // Bail out after a deadline you choose:
 * const panel = await whenInitialized(this.panelTarget, { timeout: 5000 });
 * ```
 */
export function whenInitialized<T extends Element>(
  element: T,
  { timeout }: { timeout?: number } = {},
): Promise<T> {
  // Already initialized.
  if (element.hasAttribute(IMPULSE_ELEMENT_ATTRIBUTE)) {
    return Promise.resolve(element);
  }

  // Standard elements never receive the marker attribute, so there is nothing to wait for.
  if (!element.localName.includes('-')) {
    return Promise.resolve(element);
  }

  let settled = false;
  let stop: (() => void) | undefined;

  // Wait for the class to be registered, then decide how "initialized" is defined for this element.
  const initialized = new Promise<T>((resolve) => {
    customElements.whenDefined(element.localName).then(() => {
      // The race may have already settled (e.g. timed out) before the class was defined.
      if (settled) return;

      // Non-Impulse custom elements never get the marker; being defined is as ready as they get.
      if (!isImpulseElement(element.localName)) {
        resolve(element);
        return;
      }

      // The Impulse element may have finished initializing while we waited for the definition.
      if (element.hasAttribute(IMPULSE_ELEMENT_ATTRIBUTE)) {
        resolve(element);
        return;
      }

      // `connected` fires when an element starts matching the selector, including when the marker attribute is added
      // later by `_asyncConnect`. We filter to our specific element.
      stop = connected<T>(`[${IMPULSE_ELEMENT_ATTRIBUTE}]`, (el) => {
        if (el === element) resolve(element);
      });
    });
  });

  // No deadline by default: wait until the element is ready, mirroring `customElements.whenDefined`. A never-defined tag
  // simply parks on the native `whenDefined` promise (no per-element watcher is created until the class is defined).
  if (timeout === undefined || !Number.isFinite(timeout)) {
    return initialized.finally(() => {
      settled = true;
      stop?.();
    });
  }

  let timer: ReturnType<typeof setTimeout>;
  const timedOut = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`<${element.localName}> was not initialized within ${timeout}ms.`));
    }, timeout);
  });

  // Whichever settles first wins; `finally` clears the timer and stops the shared-observer watcher on both the
  // resolve and reject paths so nothing leaks. `settled` guards against a late `whenDefined` callback registering a
  // watcher after the race has already finished.
  return Promise.race([initialized, timedOut]).finally(() => {
    settled = true;
    clearTimeout(timer);
    stop?.();
  });
}

/**
 * Whether the custom element registered for `localName` is an `ImpulseElement` (or a subclass). Returns `false` when the
 * tag is unregistered or registered to a non-Impulse class.
 */
function isImpulseElement(localName: string): boolean {
  const ctor = customElements.get(localName);
  return !!ctor && (ctor === ImpulseElement || ctor.prototype instanceof ImpulseElement);
}
