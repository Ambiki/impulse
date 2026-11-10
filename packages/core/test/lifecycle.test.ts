import type { Lifecycle, Step } from '../src/lifecycle';
import { expect, nextFrame, waitUntil } from '@open-wc/testing';
import { ImpulseElement, isInitialized, registerElement, target, targets, whenInitialized } from '../src';
import { createLifecycle } from '../src/lifecycle';
import { captureReportedErrors } from './support/capture_reported_errors';
import { captureUnhandledRejections } from './support/capture_unhandled_rejections';

let counter = 0;

describe('createLifecycle', () => {
  interface StepScript {
    /** Holds the init at this Step until the promise settles. */
    wait?: () => Promise<unknown> | undefined;
    /** Runs as the Step starts, after it is logged. */
    onStart?: (host: HTMLElement) => void;
    /** Runs as the Step stops, after it is logged. */
    onStop?: (host: HTMLElement) => void;
    /** Leaves the Step without a `stop`. */
    stopless?: boolean;
  }

  interface Script {
    host: HTMLElement;
    root: HTMLElement;
    log: string[];
    lifecycle: Lifecycle<HTMLElement>;
    /** Inserts the host and reports it as `connectedCallback` would. */
    insert: () => void;
    /** Removes the host and reports it as `disconnectedCallback` would. */
    remove: () => void;
    /** Moves the host into `parent` and reports it as a move is: a disconnect, then a connect. */
    move: (parent: HTMLElement) => void;
  }

  // The roots `script` inserts, removed after each test.
  const roots: HTMLElement[] = [];

  /** A promise the test settles, so an init held by a Step moves on when the test says. */
  function gate() {
    let open!: () => void;
    const promise = new Promise<void>((resolve) => {
      open = resolve;
    });
    return { promise, open };
  }

  /**
   * A lifecycle over the named Steps, run on a host the test inserts and removes itself. The host's tag is never
   * defined, so nothing but the test reports its connects and disconnects, in whatever order the test needs.
   */
  function script(
    steps: Record<string, StepScript> = { a: {}, b: {} },
    callbacks: { connected?: (host: HTMLElement) => void; disconnected?: (host: HTMLElement) => void } = {},
  ): Script {
    counter += 1;
    const log: string[] = [];
    const root = document.createElement('div');
    document.body.append(root);
    roots.push(root);
    const host = document.createElement(`lifecycle-host-${counter}`);
    const lifecycle = createLifecycle<HTMLElement>({
      steps: Object.entries(steps).map(([name, { wait, onStart, onStop, stopless }]): Step<HTMLElement> => ({
        start: (element) => {
          log.push(`start ${name}`);
          onStart?.(element);
          return wait?.();
        },
        stop: stopless ?
          undefined :
          (element) => {
            log.push(`stop ${name}`);
            onStop?.(element);
          },
      })),
      connected: (element) => {
        log.push('connected');
        callbacks.connected?.(element);
      },
      disconnected: (element) => {
        log.push('disconnected');
        callbacks.disconnected?.(element);
      },
      isHost: () => true,
    });
    const insert = () => {
      root.append(host);
      lifecycle.connect(host);
    };
    const remove = () => {
      host.remove();
      lifecycle.disconnect(host);
    };
    const move = (parent: HTMLElement) => {
      if (!parent.isConnected) root.append(parent);
      parent.append(host);
      lifecycle.disconnect(host);
      lifecycle.connect(host);
    };
    return { host, root, log, lifecycle, insert, remove, move };
  }

  afterEach(() => {
    for (const root of roots.splice(0)) root.remove();
  });

  it('starts every Step in order, then calls connected() with the host Initialized', () => {
    const { host, log, lifecycle, insert } = script(
      { a: {}, b: {} },
      { connected: (element) => log.push(`initialized: ${lifecycle.isInitialized(element)}`) },
    );

    insert();
    expect(log).to.deep.eq(['start a', 'start b', 'connected', 'initialized: true']);
    expect(lifecycle.isInitialized(host)).to.be.true;
    expect(host.hasAttribute('data-impulse-element')).to.be.true;
  });

  it('tears down by calling disconnected() and then stopping the Steps in reverse, no longer Initialized', () => {
    const { host, log, lifecycle, insert, remove } = script(
      { a: {}, wait: { stopless: true }, b: {} },
      {
        disconnected: (element) => {
          log.push(`initialized: ${lifecycle.isInitialized(element)}`);
          log.push(`marker: ${element.hasAttribute('data-impulse-element')}`);
        },
      },
    );
    insert();
    log.length = 0;

    remove();
    expect(log).to.deep.eq(['disconnected', 'initialized: false', 'marker: false', 'stop b', 'stop a']);
    expect(lifecycle.isInitialized(host)).to.be.false;
  });

  it('holds the init at a Step that waits, and is Initialized only once the Step lets it move on', async () => {
    const held = gate();
    const { host, log, lifecycle, insert } = script({ a: {}, held: { wait: () => held.promise }, b: {} });
    insert();
    let resolved = false;
    const initialized = lifecycle.whenInitialized(host).then((element) => {
      resolved = true;
      return element;
    });

    await nextFrame();
    expect(log).to.deep.eq(['start a', 'start held']);
    expect(lifecycle.isInitialized(host)).to.be.false;
    expect(host.hasAttribute('data-impulse-element')).to.be.false;
    expect(resolved).to.be.false;

    held.open();
    expect(await initialized).to.eq(host);
    expect(log).to.deep.eq(['start a', 'start held', 'start b', 'connected']);
    expect(lifecycle.isInitialized(host)).to.be.true;
  });

  it('abandons an init whose host is removed while a Step holds it, stopping the Steps that started in reverse', async () => {
    const held = gate();
    const { host, log, lifecycle, insert, remove } = script({
      a: {},
      held: { wait: () => held.promise, stopless: true },
      b: {},
    });
    insert();
    remove();
    held.open();
    await nextFrame();
    expect(log).to.deep.eq(['start a', 'start held', 'stop a']);
    expect(lifecycle.isInitialized(host)).to.be.false;
    expect(host.hasAttribute('data-impulse-element')).to.be.false;

    log.length = 0;
    insert();
    await nextFrame();
    expect(log).to.deep.eq(['start a', 'start held', 'start b', 'connected']);
    expect(lifecycle.isInitialized(host)).to.be.true;
  });

  it('is idle as soon as an abandoned init returns, so a connect in the next microtask starts a fresh init', async () => {
    const held = gate();
    const { host, log, lifecycle, insert, remove } = script({ held: { wait: () => held.promise, stopless: true } });
    insert();
    remove();
    held.open();
    // The init resumes first, having waited on the promise first. Going idle any later, from a `.finally()` on the init
    // say, would leave this connect finding it still initializing and drop it.
    await held.promise;
    insert();
    await nextFrame();
    expect(log).to.deep.eq(['start held', 'start held', 'connected']);
    expect(lifecycle.isInitialized(host)).to.be.true;
  });

  it('leaves connects and disconnects made during an init to it, so a host moved while held initializes once', async () => {
    const held = gate();
    const { host, log, lifecycle, insert, remove } = script({ held: { wait: () => held.promise, stopless: true }, b: {} });
    insert();
    remove();
    insert();
    held.open();
    await nextFrame();
    expect(log).to.deep.eq(['start held', 'start b', 'connected']);
    expect(lifecycle.isInitialized(host)).to.be.true;
  });

  it('abandons an init after a Step that removes the host, stopping that Step as well', () => {
    const removing = script({ a: {}, b: { onStart: () => removing.remove() }, c: {} });
    removing.insert();
    expect(removing.log).to.deep.eq(['start a', 'start b', 'stop b', 'stop a']);
    expect(removing.lifecycle.isInitialized(removing.host)).to.be.false;
    expect(removing.host.hasAttribute('data-impulse-element')).to.be.false;
  });

  it('is idle before it stops an abandoned init\'s Steps, so a stop that re-inserts the host starts a fresh init', () => {
    let removed = false;
    const reinserting = script({
      a: { onStop: () => reinserting.insert() },
      b: {
        onStart: () => {
          if (removed) return;
          removed = true;
          reinserting.remove();
        },
      },
    });
    reinserting.insert();
    expect(reinserting.log).to.deep.eq(['start a', 'start b', 'stop b', 'stop a', 'start a', 'start b', 'connected']);
    expect(reinserting.lifecycle.isInitialized(reinserting.host)).to.be.true;
  });

  it('tears down once when the host is re-inserted and removed again during the teardown', () => {
    const bouncing = script({ a: {} }, {
      disconnected: () => {
        bouncing.insert();
        bouncing.remove();
      },
    });
    bouncing.insert();
    bouncing.remove();
    expect(bouncing.log).to.deep.eq(['start a', 'connected', 'disconnected', 'stop a']);
    expect(bouncing.lifecycle.isInitialized(bouncing.host)).to.be.false;
  });

  it('runs every teardown call and goes idle when some throw, rethrowing the first error', () => {
    const throwing = script(
      {
        a: {
          onStop: () => {
            throw new Error('stop a failed');
          },
        },
        b: {},
      },
      {
        disconnected: () => {
          throw new Error('disconnected failed');
        },
      },
    );
    throwing.insert();
    expect(() => throwing.remove()).to.throw('disconnected failed');
    expect(throwing.log).to.deep.eq(['start a', 'start b', 'connected', 'disconnected', 'stop b', 'stop a']);

    throwing.log.length = 0;
    throwing.insert();
    expect(throwing.log).to.deep.eq(['start a', 'start b', 'connected']);
    expect(throwing.lifecycle.isInitialized(throwing.host)).to.be.true;
  });

  it('keeps a whenInitialized() call made during the teardown waiting for the next init', async () => {
    let waited: Promise<HTMLElement> | undefined;
    let resolved = false;
    const waiting = script({ a: {} }, {
      disconnected: (element) => {
        waited = waiting.lifecycle.whenInitialized(element).then((initialized) => {
          resolved = true;
          return initialized;
        });
      },
    });
    waiting.insert();
    waiting.remove();
    await nextFrame();
    expect(resolved).to.be.false;

    waiting.insert();
    expect(await waited).to.eq(waiting.host);
  });

  it('resolves a whenInitialized() call made by a teardown call that re-inserts the host once the fresh init has run', async () => {
    let waited: Promise<boolean> | undefined;
    const waiting = script({ a: {} }, {
      disconnected: (element) => {
        if (waited) return;
        waiting.insert();
        waited = waiting.lifecycle.whenInitialized(element).then(() => element.hasAttribute('data-impulse-element'));
      },
    });
    waiting.insert();
    waiting.remove();
    expect(await waited).to.be.true;
    expect(waiting.log).to.deep.eq(['start a', 'connected', 'disconnected', 'stop a', 'start a', 'connected']);
  });

  it('tears down and starts a fresh init when connected() moves the host', () => {
    let moved = false;
    const other = document.createElement('div');
    const moving = script({ a: {} }, {
      connected: () => {
        if (moved) return;
        moved = true;
        moving.move(other);
      },
    });
    moving.insert();
    expect(moving.log).to.deep.eq(['start a', 'connected', 'disconnected', 'stop a', 'start a', 'connected']);
    expect(moving.host.parentElement).to.eq(other);
    expect(moving.lifecycle.isInitialized(moving.host)).to.be.true;
  });

  it('initializes once when moved again while the init started by a move in connected() is held', async () => {
    const held = gate();
    let inits = 0;
    const other = document.createElement('div');
    const moving = script(
      {
        held: {
          wait: () => {
            inits += 1;
            return inits === 2 ? held.promise : undefined;
          },
          stopless: true,
        },
      },
      {
        connected: () => {
          if (inits === 1) moving.move(other);
        },
      },
    );
    moving.insert();
    expect(moving.log).to.deep.eq(['start held', 'connected', 'disconnected', 'start held']);

    moving.move(moving.root);
    held.open();
    await nextFrame();
    expect(moving.log).to.deep.eq(['start held', 'connected', 'disconnected', 'start held', 'connected']);
    expect(moving.host.parentElement).to.eq(moving.root);
    expect(moving.lifecycle.isInitialized(moving.host)).to.be.true;
  });

  // A move reports a disconnect and then a connect. When a teardown call queues another reaction on the element,
  // Chromium and Firefox report the move's connect inside the teardown; WebKit reports it once the teardown returns.
  it('starts a fresh init once the teardown returns when a move reports its connect inside the teardown', () => {
    const other = document.createElement('div');
    const moving = script({ a: {} }, {
      disconnected: (element) => {
        if (moving.log.filter((entry) => entry === 'disconnected').length === 1) moving.lifecycle.connect(element);
      },
    });
    moving.insert();
    moving.root.append(other);
    other.append(moving.host);
    moving.lifecycle.disconnect(moving.host);
    expect(moving.log).to.deep.eq(['start a', 'connected', 'disconnected', 'stop a', 'start a', 'connected']);
    expect(moving.lifecycle.isInitialized(moving.host)).to.be.true;
  });

  it('starts a fresh init from the connect when a move reports it once the teardown has returned', () => {
    const moving = script({ a: {} });
    moving.insert();
    moving.move(document.createElement('div'));
    expect(moving.log).to.deep.eq(['start a', 'connected', 'disconnected', 'stop a', 'start a', 'connected']);
    expect(moving.lifecycle.isInitialized(moving.host)).to.be.true;
  });

  it('re-initializes when a teardown call re-inserts the host', () => {
    const reinserting = script({ a: {} }, {
      disconnected: () => {
        if (reinserting.log.filter((entry) => entry === 'disconnected').length === 1) reinserting.insert();
      },
    });
    reinserting.insert();
    reinserting.remove();
    expect(reinserting.log).to.deep.eq(['start a', 'connected', 'disconnected', 'stop a', 'start a', 'connected']);
    expect(reinserting.host.isConnected).to.be.true;
    expect(reinserting.lifecycle.isInitialized(reinserting.host)).to.be.true;
  });

  it('does not start an init for a host left in the document when no connect is reported', () => {
    const moving = script({ a: {} });
    moving.insert();
    const other = document.createElement('div');
    moving.root.append(other);
    // A subclass whose `connectedCallback` skips `super` reports the move's disconnect and not its connect.
    other.append(moving.host);
    moving.lifecycle.disconnect(moving.host);
    expect(moving.log).to.deep.eq(['start a', 'connected', 'disconnected', 'stop a']);
    expect(moving.lifecycle.isInitialized(moving.host)).to.be.false;
    expect(moving.host.hasAttribute('data-impulse-element')).to.be.false;
  });

  it('reports attribute changes from when the host is Initialized until its teardown has returned', async () => {
    const held = gate();
    const seen: string[] = [];
    const reporting = script(
      {
        held: {
          wait: () => held.promise,
          onStop: (element) => seen.push(`stop: ${reporting.lifecycle.reportsChanges(element)}`),
        },
      },
      {
        connected: (element) => seen.push(`connected: ${reporting.lifecycle.reportsChanges(element)}`),
        disconnected: (element) => seen.push(`disconnected: ${reporting.lifecycle.reportsChanges(element)}`),
      },
    );
    const { host, lifecycle } = reporting;
    expect(lifecycle.reportsChanges(host)).to.be.false;
    reporting.insert();
    expect(lifecycle.reportsChanges(host)).to.be.false;

    held.open();
    await nextFrame();
    expect(lifecycle.reportsChanges(host)).to.be.true;
    reporting.remove();
    expect(lifecycle.reportsChanges(host)).to.be.false;
    expect(seen).to.deep.eq(['connected: true', 'disconnected: true', 'stop: true']);
  });

  it('resolves whenInitialized() before calling connected(), so a connected() that throws leaves no one waiting', async () => {
    const rejections = captureUnhandledRejections('connected failed');
    try {
      const throwing = script({ a: {} }, {
        connected: () => {
          throw new Error('connected failed');
        },
      });
      const ready = throwing.lifecycle.whenInitialized(throwing.host);
      throwing.insert();
      expect(await ready).to.eq(throwing.host);
      expect(throwing.lifecycle.isInitialized(throwing.host)).to.be.true;
      await rejections.caught();
      expect(rejections.rejected.map((error) => error.message)).to.deep.eq(['connected failed']);
    } finally {
      rejections.release();
    }
  });

  it('unwinds an init whose Step throws as a removal would, going idle and rethrowing the error', async () => {
    const rejections = captureUnhandledRejections('start b failed');
    let thrown = false;
    try {
      const throwing = script({
        a: {},
        b: {
          onStart: () => {
            if (thrown) return;
            thrown = true;
            throw new Error('start b failed');
          },
        },
        c: {},
      });
      throwing.insert();
      expect(throwing.log).to.deep.eq(['start a', 'start b', 'stop b', 'stop a']);
      expect(throwing.lifecycle.isInitialized(throwing.host)).to.be.false;
      expect(throwing.lifecycle.reportsChanges(throwing.host)).to.be.false;

      throwing.log.length = 0;
      throwing.remove();
      throwing.insert();
      expect(throwing.log).to.deep.eq(['start a', 'start b', 'start c', 'connected']);
      await rejections.caught();
      expect(rejections.rejected.map((error) => error.message)).to.deep.eq(['start b failed']);
    } finally {
      rejections.release();
    }
  });

  it('unwinds an init whose Step\'s promise rejects as a removal would', async () => {
    const rejections = captureUnhandledRejections('wait failed');
    try {
      const rejecting = script({
        a: {},
        waiting: { wait: () => Promise.reject(new Error('wait failed')) },
        b: {},
      });
      rejecting.insert();
      await rejections.caught();
      expect(rejecting.log).to.deep.eq(['start a', 'start waiting', 'stop waiting', 'stop a']);
      expect(rejecting.lifecycle.isInitialized(rejecting.host)).to.be.false;
      expect(rejections.rejected.map((error) => error.message)).to.deep.eq(['wait failed']);
    } finally {
      rejections.release();
    }
  });

  it('reports a stop that throws while a throwing Step is unwound, and rethrows the Step\'s error', async () => {
    const rejections = captureUnhandledRejections('start b failed');
    const reported = captureReportedErrors('stop a failed');
    try {
      const throwing = script({
        a: {
          onStop: () => {
            throw new Error('stop a failed');
          },
        },
        b: {
          onStart: () => {
            throw new Error('start b failed');
          },
        },
      });
      throwing.insert();
      expect(throwing.log).to.deep.eq(['start a', 'start b', 'stop b', 'stop a']);
      expect(reported.reported.map((error) => error.message)).to.deep.eq(['stop a failed']);
      await rejections.caught();
      expect(rejections.rejected.map((error) => error.message)).to.deep.eq(['start b failed']);
    } finally {
      reported.release();
      rejections.release();
    }
  });

  it('waits for a host to initialize, and for any other custom element only to be defined', async () => {
    counter += 1;
    const hostTag = `lifecycle-defined-host-${counter}`;
    const otherTag = `lifecycle-other-${counter}`;
    class Host extends HTMLElement {}
    const lifecycle = createLifecycle<HTMLElement>({
      steps: [],
      connected: () => {},
      disconnected: () => {},
      isHost: (ctor) => ctor === Host,
    });
    const host = document.createElement(hostTag);
    const other = document.createElement(otherTag);
    let hostResolved = false;
    const hostReady = lifecycle.whenInitialized(host).then(() => {
      hostResolved = true;
    });
    const otherReady = lifecycle.whenInitialized(other);

    customElements.define(hostTag, Host);
    customElements.define(otherTag, class extends HTMLElement {});
    expect(await otherReady).to.eq(other);
    await nextFrame();
    expect(hostResolved).to.be.false;

    document.body.append(host);
    try {
      lifecycle.connect(host);
      await hostReady;
      expect(lifecycle.isInitialized(host)).to.be.true;
    } finally {
      host.remove();
    }
  });
});

describe('whenInitialized', () => {
  const CONNECTION_TIMEOUT_MS = 200;

  /** Waits for `element` to advertise that it has initialized, so a test can start from a known state. */
  function waitForMarker(element: Element) {
    return waitUntil(() => element.hasAttribute('data-impulse-element'), 'element should initialize', {
      timeout: CONNECTION_TIMEOUT_MS,
    });
  }

  /** Asserts that `promise` is still waiting once a beat has passed, rather than having resolved or rejected. */
  async function expectPending(promise: Promise<unknown>) {
    const outcome = await Promise.race([
      promise.then(() => 'settled', () => 'settled'),
      new Promise((resolve) => setTimeout(resolve, 50, 'pending')),
    ]);
    expect(outcome).to.eq('pending');
  }

  it('resolves with the element when it is already initialized', async () => {
    counter += 1;
    const tag = `when-initialized-${counter}`;
    class WhenInitializedElement extends ImpulseElement {}
    registerElement(tag)(WhenInitializedElement);

    const element = document.createElement(tag) as WhenInitializedElement;
    document.body.appendChild(element);

    try {
      await waitForMarker(element);
      const resolved = await whenInitialized(element);
      expect(resolved).to.eq(element);
    } finally {
      element.remove();
    }
  });

  it('resolves once the element becomes initialized', async () => {
    counter += 1;
    const tag = `when-initialized-${counter}`;
    class WhenInitializedElement extends ImpulseElement {}
    registerElement(tag)(WhenInitializedElement);

    const element = document.createElement(tag) as WhenInitializedElement;
    document.body.appendChild(element);

    try {
      // Called before the init has set the marker attribute.
      expect(element.hasAttribute('data-impulse-element')).to.be.false;
      const resolved = await whenInitialized(element);
      expect(resolved).to.eq(element);
      expect(element.hasAttribute('data-impulse-element')).to.be.true;
    } finally {
      element.remove();
    }
  });

  it('resolves when the element class is registered after the call', async () => {
    counter += 1;
    const tag = `when-initialized-${counter}`;
    class WhenInitializedElement extends ImpulseElement {}

    // Create and attach the element before its class is defined.
    const element = document.createElement(tag) as WhenInitializedElement;
    document.body.appendChild(element);

    try {
      const promise = whenInitialized(element);
      registerElement(tag)(WhenInitializedElement);
      const resolved = await promise;
      expect(resolved).to.eq(element);
      expect(element.hasAttribute('data-impulse-element')).to.be.true;
    } finally {
      element.remove();
    }
  });

  it('resolves immediately for a standard HTML element', async () => {
    const element = document.createElement('div');
    expect(element.hasAttribute('data-impulse-element')).to.be.false;
    const resolved = await whenInitialized(element);
    expect(resolved).to.eq(element);
  });

  it('resolves once a non-Impulse custom element is defined', async () => {
    counter += 1;
    const tag = `non-impulse-${counter}`;
    // A plain custom element that is not an ImpulseElement, so it never receives the marker attribute.
    class Plain extends HTMLElement {}
    customElements.define(tag, Plain);

    const element = document.createElement(tag);
    document.body.appendChild(element);

    try {
      const resolved = await whenInitialized(element, { timeout: CONNECTION_TIMEOUT_MS });
      expect(resolved).to.eq(element);
      expect(element.hasAttribute('data-impulse-element')).to.be.false;
    } finally {
      element.remove();
    }
  });

  it('resolves once a non-Impulse custom element is defined after the call', async () => {
    counter += 1;
    const tag = `non-impulse-late-${counter}`;
    class Plain extends HTMLElement {}

    const element = document.createElement(tag);
    document.body.appendChild(element);

    try {
      const promise = whenInitialized(element, { timeout: CONNECTION_TIMEOUT_MS });
      customElements.define(tag, Plain);
      const resolved = await promise;
      expect(resolved).to.eq(element);
    } finally {
      element.remove();
    }
  });

  it('waits indefinitely by default and resolves once the element initializes', async () => {
    counter += 1;
    const tag = `no-timeout-${counter}`;
    class WhenInitializedElement extends ImpulseElement {}

    const element = document.createElement(tag) as WhenInitializedElement;
    document.body.appendChild(element);

    try {
      const promise = whenInitialized(element);

      // With no deadline the promise stays pending while the tag is unregistered - it does not reject.
      await expectPending(promise);

      // Once the class is registered it resolves.
      registerElement(tag)(WhenInitializedElement);
      const resolved = await promise;
      expect(resolved).to.eq(element);
    } finally {
      element.remove();
    }
  });

  it('rejects after an explicit timeout when the element never initializes', async () => {
    counter += 1;
    // A hyphenated tag that is never registered, so it never initializes.
    const tag = `never-impulse-${counter}`;
    const element = document.createElement(tag);
    document.body.appendChild(element);

    let error: unknown;
    try {
      await whenInitialized(element, { timeout: 50 });
    } catch (err) {
      error = err;
    } finally {
      element.remove();
    }

    expect(error).to.be.an.instanceOf(Error);
  });

  it('resolves when the element is removed in the same task it initializes', async () => {
    counter += 1;
    const tag = `same-task-removal-${counter}`;
    class WhenInitializedElement extends ImpulseElement {
      connected() {
        // Initializing and disconnecting within one task must still resolve whoever was waiting on this element.
        this.remove();
      }
    }
    registerElement(tag)(WhenInitializedElement);

    const element = document.createElement(tag) as WhenInitializedElement;
    document.body.appendChild(element);

    const resolved = await whenInitialized(element, { timeout: CONNECTION_TIMEOUT_MS });
    expect(resolved).to.eq(element);
    expect(element.isConnected).to.be.false;
  });

  it('stays pending while the marker attribute is stale', async () => {
    counter += 1;
    const tag = `stale-marker-${counter}`;
    class WhenInitializedElement extends ImpulseElement {
      initialized = false;

      connected() {
        this.initialized = true;
      }
    }
    registerElement(tag)(WhenInitializedElement);

    const element = document.createElement(tag) as WhenInitializedElement;
    document.body.appendChild(element);

    try {
      await waitForMarker(element);

      // A copy carries the marker attribute over, but has initialized nothing.
      const clone = element.cloneNode(true) as WhenInitializedElement;
      expect(clone.hasAttribute('data-impulse-element')).to.be.true;
      const promise = whenInitialized(clone);

      await expectPending(promise);

      document.body.appendChild(clone);
      try {
        const resolved = await promise;
        expect(resolved).to.eq(clone);
        expect(resolved.initialized).to.be.true;
      } finally {
        clone.remove();
      }
    } finally {
      element.remove();
    }
  });

  it('stays pending for a disconnected element until it is connected again', async () => {
    counter += 1;
    const tag = `reconnected-${counter}`;
    class WhenInitializedElement extends ImpulseElement {}
    registerElement(tag)(WhenInitializedElement);

    const element = document.createElement(tag) as WhenInitializedElement;
    document.body.appendChild(element);

    try {
      await waitForMarker(element);
      element.remove();

      const promise = whenInitialized(element);
      await expectPending(promise);

      document.body.appendChild(element);
      const resolved = await promise;
      expect(resolved).to.eq(element);
    } finally {
      element.remove();
    }
  });
});

describe('isInitialized', () => {
  it('is true inside connected()', async () => {
    counter += 1;
    const tag = `is-initialized-${counter}`;
    let seen: boolean | undefined;
    class IsInitializedElement extends ImpulseElement {
      connected() {
        seen = isInitialized(this);
      }
    }
    registerElement(tag)(IsInitializedElement);

    const element = document.createElement(tag);
    document.body.appendChild(element);

    try {
      await whenInitialized(element);
      expect(seen).to.be.true;
    } finally {
      element.remove();
    }
  });

  it('is false inside [target]Connected() during init, and true for a target added after it', async () => {
    counter += 1;
    const tag = `is-initialized-${counter}`;
    const seen: boolean[] = [];
    class IsInitializedElement extends ImpulseElement {
      @targets() items!: HTMLElement[];

      itemsConnected() {
        seen.push(isInitialized(this));
      }
    }
    registerElement(tag)(IsInitializedElement);

    const element = document.createElement(tag);
    element.innerHTML = `<span data-target="${tag}.items"></span>`;
    document.body.appendChild(element);

    try {
      await whenInitialized(element);
      expect(seen).to.deep.eq([false]);

      const later = document.createElement('span');
      later.setAttribute('data-target', `${tag}.items`);
      element.appendChild(later);
      await waitUntil(() => seen.length === 2, 'the later target should connect');
      expect(seen).to.deep.eq([false, true]);
    } finally {
      element.remove();
    }
  });

  it('is false inside disconnected() and [target]Disconnected()', async () => {
    counter += 1;
    const tag = `is-initialized-${counter}`;
    const seen: Record<string, boolean> = {};
    class IsInitializedElement extends ImpulseElement {
      @target() panel!: HTMLElement;

      disconnected() {
        seen.disconnected = isInitialized(this);
      }

      panelDisconnected() {
        seen.panelDisconnected = isInitialized(this);
      }
    }
    registerElement(tag)(IsInitializedElement);

    const element = document.createElement(tag);
    element.innerHTML = `<div data-target="${tag}.panel"></div>`;
    document.body.appendChild(element);

    try {
      await whenInitialized(element);
      element.remove();
      expect(seen).to.deep.eq({ disconnected: false, panelDisconnected: false });
    } finally {
      element.remove();
    }
  });

  it('is false once the element is removed, and true again once it re-initializes', async () => {
    counter += 1;
    const tag = `is-initialized-${counter}`;
    class IsInitializedElement extends ImpulseElement {}
    registerElement(tag)(IsInitializedElement);

    const element = document.createElement(tag);
    document.body.appendChild(element);

    try {
      await whenInitialized(element);
      element.remove();
      expect(isInitialized(element)).to.be.false;

      document.body.appendChild(element);
      expect(isInitialized(element)).to.be.false;
      await whenInitialized(element);
      expect(isInitialized(element)).to.be.true;
    } finally {
      element.remove();
    }
  });

  it('is false for a copy carrying the marker attribute until the copy initializes', async () => {
    counter += 1;
    const tag = `is-initialized-${counter}`;
    class IsInitializedElement extends ImpulseElement {}
    registerElement(tag)(IsInitializedElement);

    const element = document.createElement(tag);
    document.body.appendChild(element);
    let copy: Element | undefined;

    try {
      await whenInitialized(element);
      copy = element.cloneNode(true) as Element;
      expect(copy.hasAttribute('data-impulse-element')).to.be.true;
      expect(isInitialized(copy)).to.be.false;

      document.body.appendChild(copy);
      expect(isInitialized(copy)).to.be.false;
      await whenInitialized(copy);
      expect(isInitialized(copy)).to.be.true;
    } finally {
      element.remove();
      copy?.remove();
    }
  });

  it('is false for elements that never initialize', async () => {
    counter += 1;
    const tag = `non-impulse-${counter}`;
    customElements.define(tag, class extends HTMLElement {});

    const div = document.createElement('div');
    const plain = document.createElement(tag);
    document.body.append(div, plain);

    try {
      await whenInitialized(div);
      await whenInitialized(plain);
      expect(isInitialized(div)).to.be.false;
      expect(isInitialized(plain)).to.be.false;
    } finally {
      div.remove();
      plain.remove();
    }
  });
});
