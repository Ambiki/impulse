// Tracks which elements have finished initializing and notifies whoever is waiting on them.
//
// The `data-impulse-element` attribute marks an initialized element for stylesheets, tests, and anything else reading
// the DOM, but it is a consequence of initializing rather than the record of it: an attribute can be copied by
// `cloneNode` or written into server-rendered HTML, neither of which starts an element. The state lives here instead,
// keyed by the element, so it is set only by the element that actually initialized.
//
// Waiting is a direct registration rather than a `connected('[data-impulse-element]')` watcher on the shared document
// observer. A watcher is the wrong shape for waiting on one known element: registering one scans the whole document
// and indexes every element already carrying the marker, only to discard all but one of them, so N concurrent waits on
// a page of M initialized elements cost O(N * M). A registration here costs a `WeakMap` set, and the element notifies
// its waiters itself.

import { invokeReporting } from './helpers/errors';

const initialized = new WeakSet<Element>();
const waiters = new WeakMap<Element, Set<(element: Element) => void>>();

/**
 * Whether `element` has finished initializing and has not been disconnected since.
 */
export function isInitialized(element: Element): boolean {
  return initialized.has(element);
}

/**
 * Registers `callback` to be invoked with `element` the next time it finishes initializing. Returns a function that
 * deregisters it, and that does nothing once the callback has been invoked: notifying detaches the whole set, so the
 * one held here is no longer the element's.
 */
export function waitForInitialization<T extends Element>(element: T, callback: (element: T) => void): () => void {
  const waiter = callback as (element: Element) => void;
  let callbacks = waiters.get(element);
  if (!callbacks) {
    callbacks = new Set();
    waiters.set(element, callbacks);
  }
  callbacks.add(waiter);
  const registered = callbacks;

  return () => {
    if (waiters.get(element) !== registered) return;
    registered.delete(waiter);
    if (registered.size === 0) waiters.delete(element);
  };
}

/**
 * Records `element` as initialized and invokes every callback waiting on it. The waiters are detached before any of
 * them runs, so a callback registering a new wait is not discarded along with the ones being invoked. A callback that
 * throws is reported like an uncaught error rather than unwinding the element that is initializing.
 */
export function notifyInitialized(element: Element): void {
  initialized.add(element);
  const callbacks = waiters.get(element);
  if (!callbacks) return;
  waiters.delete(element);
  for (const callback of callbacks) invokeReporting(() => callback(element));
}

/**
 * Records `element` as no longer initialized. Callbacks waiting on it keep waiting: an element that is connected again
 * initializes again, and notifies them then.
 */
export function clearInitialized(element: Element): void {
  initialized.delete(element);
}
