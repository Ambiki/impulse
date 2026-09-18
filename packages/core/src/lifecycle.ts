import { ImpulseElement } from './element';
import { invokeEach } from './helpers/invoke_each';
import { isInitialized, waitForInitialization } from './initialization';
import { watchSelector } from './observers/document_observer';

/**
 * Observes the DOM and invokes a callback whenever elements matching the selector are added to the DOM.
 *
 * This function sets up a MutationObserver on the document that watches for elements matching
 * the provided CSS selector. The callback is invoked immediately for any matching elements
 * already in the DOM, then for any elements added later, and for any element whose attributes
 * change such that it starts matching the selector.
 *
 * @param selector - CSS selector to match elements against
 * @param callback - Function to invoke when a matching element is mounted. Can optionally return
 *                   a cleanup function that will be called when the element is disconnected. If it
 *                   throws, the error is reported like an uncaught error and other watchers still run.
 * @returns A cleanup function that stops observing and runs the pending cleanup of every element still connected
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
 * once its properties, targets, and actions have started.
 *
 * This mirrors the familiar `customElements.whenDefined()` pattern, but for an Impulse element resolves on full
 * initialization rather than mere definition.
 *
 * - **Standard HTML elements** (a tag name without a hyphen can never be a custom element) resolve immediately —
 *   there is nothing to initialize.
 * - **Impulse custom elements** resolve once they have initialized. A `data-impulse-element` attribute that was copied
 *   by `cloneNode` or hand-written rather than set by the element itself does not count.
 * - **Non-Impulse custom elements** never initialize, so they resolve as soon as their class is defined
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
  if (isInitialized(element)) {
    return Promise.resolve(element);
  }

  // Standard elements never initialize, so there is nothing to wait for.
  if (!element.localName.includes('-')) {
    return Promise.resolve(element);
  }

  let stop: () => void;
  const initialized = new Promise<T>((resolve) => {
    // Registered before the class is known to be defined: an element notifies its own waiters, so there is nothing for
    // the definition to decide, and a registration is a `WeakMap` set rather than something worth deferring.
    stop = waitForInitialization(element, resolve);

    // A non-Impulse custom element is never notified, so being defined is as far as it gets. Resolving a promise
    // that has already settled is a no-op, so an Impulse element that initialized while we waited needs no guard.
    customElements.whenDefined(element.localName).then(() => {
      if (!isImpulseElement(element.localName)) resolve(element);
    });
  });

  // No deadline by default: wait until the element is ready, mirroring `customElements.whenDefined`. A never-defined
  // tag simply keeps its registration, which is dropped along with the element itself.
  if (timeout === undefined || !Number.isFinite(timeout)) {
    return initialized.finally(() => stop());
  }

  let timer: ReturnType<typeof setTimeout>;
  const timedOut = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`<${element.localName}> was not initialized within ${timeout}ms.`));
    }, timeout);
  });

  // Whichever settles first wins; `finally` clears the timer and deregisters the wait on both the resolve and reject
  // paths, so a timed-out call leaves nothing behind on an element that initializes later.
  return Promise.race([initialized, timedOut]).finally(() => {
    clearTimeout(timer);
    stop();
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
