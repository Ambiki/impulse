import { IMPULSE_ELEMENT_ATTRIBUTE } from './constants';
import { invokeReporting } from './helpers/errors';
import { invokeEach } from './helpers/invoke_each';

/**
 * One Step of an element's initialization. `start` runs as the element initializes, in the order the Steps are listed;
 * one that returns a promise holds the init until the promise settles. `stop`, when there is one, undoes `start`: the
 * Steps that started are stopped in reverse order when the element is torn down or its init is abandoned.
 */
export interface Step<H extends Element> {
  start: (host: H) => void | Promise<unknown>;
  stop?: (host: H) => void;
}

export interface LifecycleOptions<H extends Element> {
  /** The Steps an init starts, in order, before the element is Initialized. */
  steps: ReadonlyArray<Step<H>>;
  /** Called once the element is Initialized. */
  connected: (host: H) => void;
  /** Called as a teardown begins, once the element is no longer Initialized and before any Step is stopped. */
  disconnected: (host: H) => void;
  /**
   * Whether the elements a custom element class defines run this lifecycle, so `whenInitialized` waits for one to
   * initialize rather than only for its class to be defined.
   */
  isHost: (ctor: CustomElementConstructor) => boolean;
}

export interface Lifecycle<H extends Element> {
  /** Reports that `host` was connected, as `connectedCallback` does. */
  connect: (host: H) => void;
  /** Reports that `host` was disconnected, as `disconnectedCallback` does. */
  disconnect: (host: H) => void;
  /**
   * Whether an attribute change on `host` is reported: from the moment it is Initialized until its teardown has
   * returned, so a `disconnected()` that sets a property is still told about it.
   */
  reportsChanges: (host: H) => boolean;
  /** Whether `element` is a host that is Initialized right now. */
  isInitialized: (element: Element) => boolean;
  /**
   * Resolves with `element` once it is ready: a host once it is Initialized, any other custom element once its class is
   * defined, and a standard element at once. Rejects after `timeout` milliseconds, if given.
   */
  whenInitialized: <T extends Element>(element: T, options?: { timeout?: number }) => Promise<T>;
}

interface Initializing {
  readonly phase: 'initializing';
}

interface TearingDown {
  readonly phase: 'tearingDown';
  reconnected: boolean;
}

/**
 * The Phase of a host that is not idle. An idle host has no Phase recorded.
 *
 * - `initializing`: an init is starting the Steps. It re-checks `isConnected` after each one, so connects and
 *   disconnects are left to it.
 * - `initialized`: the host is Initialized. A disconnect starts a teardown.
 * - `tearingDown`: a teardown is calling `disconnected()` and stopping the Steps, which can reconnect the host or remove
 *   it again. A reconnect is only recorded, and acted on once the teardown has returned.
 */
type Phase = Initializing | { readonly phase: 'initialized' } | TearingDown;

const INITIALIZED: Phase = { phase: 'initialized' };

/**
 * Builds the lifecycle that hosts run: an init that starts `steps` in order and then calls `connected`, and a teardown
 * that calls `disconnected` and then stops the Steps in reverse.
 *
 * Each host's Phase is kept here rather than on the host. The `data-impulse-element` attribute marks an Initialized
 * host for stylesheets, tests and anything else reading the DOM, but it is a consequence of initializing rather than the
 * record of it: an attribute can be copied by `cloneNode` or written into server-rendered HTML, neither of which starts
 * an element.
 */
export function createLifecycle<H extends Element>({
  steps,
  connected,
  disconnected,
  isHost,
}: LifecycleOptions<H>): Lifecycle<H> {
  const phases = new WeakMap<Element, Phase>();
  // Waiting is a direct registration rather than a `connected('[data-impulse-element]')` Watcher on the shared document
  // observer. A Watcher is the wrong shape for waiting on one known element: registering one scans the whole document
  // and indexes every element already carrying the marker, only to discard all but one of them, so N concurrent waits on
  // a page of M Initialized elements cost O(N * M). A registration here costs a `WeakMap` set, and the init notifies
  // its waiters itself.
  const waiters = new WeakMap<Element, Set<(element: Element) => void>>();
  // A teardown's calls, in order: `disconnected`, then every Step's `stop` in reverse.
  const teardown: Array<(host: H) => void> = [disconnected];
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const { stop } = steps[index];
    if (stop) teardown.push(stop);
  }

  async function initialize(host: H) {
    // The `initializing` Phase is replaced inside this function (by `initialized` before `connected`, and by idle in the
    // `finally` on every other exit) rather than from a `.finally()` on its promise, so it changes synchronously: a
    // reconnect in the next microtask must find the host idle and start a fresh init. Each init gets its own Phase
    // object and resets only that one: a move inside `connected` starts a new init that is still initializing when this
    // one returns, and resetting that one would let a further reconnect start a second init alongside it.
    const initializing: Initializing = { phase: 'initializing' };
    phases.set(host, initializing);
    try {
      for (let index = 0; index < steps.length; index += 1) {
        const waiting: unknown = steps[index].start(host);
        if (waiting) await waiting;
        // A Step can run code that removes the host (a target's connected callback, or another element's callback run
        // by a flush), and a removal while it waits leaves it to this check. A disconnect is ignored until the host is
        // Initialized, so the check follows every Step.
        if (!host.isConnected) {
          abandon(host, index + 1);
          return;
        }
      }
      // Initialized once every Step has started, so a move inside `connected` takes the normal disconnect and reconnect
      // path: `disconnected`, then a fresh init at the new position. Still initializing, the reconnect would be dropped
      // and the host left in the document torn down.
      phases.set(host, INITIALIZED);
      host.setAttribute(IMPULSE_ELEMENT_ATTRIBUTE, '');
      // Before `connected`, so the marker being set and the waiters being resolved are one step: a `connected` that
      // throws, or that removes the host, cannot leave a `whenInitialized()` call waiting forever.
      notifyInitialized(host);
      connected(host);
    } finally {
      if (phases.get(host) === initializing) phases.delete(host);
    }
  }

  /**
   * Stops the first `started` Steps, in reverse, for an init whose host was removed, so a later reconnect starts over.
   * Stopping can run code that reconnects the host (a target's disconnected callback, say), so the host is idle by
   * then: the reconnect starts a fresh init rather than being dropped.
   */
  function abandon(host: H, started: number) {
    phases.delete(host);
    const stops: Array<(host: H) => void> = [];
    for (let index = started - 1; index >= 0; index -= 1) {
      const { stop } = steps[index];
      if (stop) stops.push(stop);
    }
    invokeEach(stops, (stop) => stop(host));
  }

  function connect(host: H) {
    const phase = phases.get(host);
    // A reconnect during a teardown is only recorded: the teardown starts the fresh init once it has returned.
    if (phase?.phase === 'tearingDown') {
      phase.reconnected = true;
      return;
    }
    // Only an idle host starts an init. A reconnect while one is initializing must not start a second; the pending init
    // finishes on its own.
    if (!phase) void initialize(host);
  }

  function disconnect(host: H) {
    // Only an Initialized host is torn down. An init still running re-checks `isConnected` itself, and a removal during a
    // teardown, after a teardown call reconnected the host, must not run the teardown a second time.
    if (phases.get(host) !== INITIALIZED) return;
    // The host stops being Initialized as the teardown begins, so a `whenInitialized()` call made by a teardown call
    // waits for the next init rather than resolving with a host that is being torn down.
    const tearingDown: TearingDown = { phase: 'tearingDown', reconnected: false };
    phases.set(host, tearingDown);
    host.removeAttribute(IMPULSE_ELEMENT_ATTRIBUTE);
    // Every call runs even if an earlier one throws, so a throwing `disconnected` cannot leave a Step started or the host
    // unable to initialize again; the first error is rethrown once the teardown is done.
    try {
      invokeEach(teardown, (call) => call(host));
    } finally {
      phases.delete(host);
      // A connect recorded during the teardown starts the fresh init here, unless the host was removed again since.
      // That is either a teardown call reconnecting the host, or the connect of the move that started this teardown: a
      // teardown call that queues another reaction on the element makes Chromium and Firefox report the move's connect
      // inside the teardown. Otherwise a move reports its connect once this returns, and initializes there.
      if (tearingDown.reconnected && host.isConnected) void initialize(host);
    }
  }

  function reportsChanges(host: H): boolean {
    const phase = phases.get(host);
    return phase === INITIALIZED || phase?.phase === 'tearingDown';
  }

  function isInitialized(element: Element): boolean {
    return phases.get(element) === INITIALIZED;
  }

  /**
   * Registers `callback` to be invoked with `element` the next time it is Initialized. Returns a function that
   * deregisters it, and that does nothing once the callback has been invoked: notifying detaches the whole set, so the
   * one held here is no longer the element's.
   */
  function waitForInitialization<T extends Element>(element: T, callback: (element: T) => void): () => void {
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
   * Invokes every callback waiting on `element`. The waiters are detached before any of them runs, so a callback
   * registering a new wait is not discarded along with the ones being invoked. A callback that throws is reported like
   * an uncaught error rather than unwinding the init.
   */
  function notifyInitialized(element: Element) {
    const callbacks = waiters.get(element);
    if (!callbacks) return;
    waiters.delete(element);
    for (const callback of callbacks) invokeReporting(() => callback(element));
  }

  function whenInitialized<T extends Element>(element: T, { timeout }: { timeout?: number } = {}): Promise<T> {
    if (isInitialized(element)) {
      return Promise.resolve(element);
    }

    // Standard elements never initialize, so there is nothing to wait for.
    if (!element.localName.includes('-')) {
      return Promise.resolve(element);
    }

    let stop: () => void;
    const initialized = new Promise<T>((resolve) => {
      // Registered before the class is known to be defined: a host notifies its own waiters, so there is nothing for the
      // definition to decide, and a registration is a `WeakMap` set rather than something worth deferring.
      stop = waitForInitialization(element, resolve);

      // Any other custom element is never notified, so being defined is as far as it gets. Resolving a promise that has
      // already settled is a no-op, so a host that initialized while we waited needs no guard.
      customElements.whenDefined(element.localName).then(() => {
        const ctor = customElements.get(element.localName);
        if (!ctor || !isHost(ctor)) resolve(element);
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

  return { connect, disconnect, reportsChanges, isInitialized, whenInitialized };
}
