import { ImpulseElement } from './element';
import { isInitialized, waitForInitialization } from './initialization';

export { isInitialized };

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
 * const select = await whenInitialized(this.select);
 * select.doSomething();
 *
 * // Bail out after a deadline you choose:
 * const panel = await whenInitialized(this.panel, { timeout: 5000 });
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
