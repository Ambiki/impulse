import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import Sinon from 'sinon';
import { connected, disconnected, ImpulseElement, registerElement, whenInitialized } from '../src';
import { captureReportedErrors } from './support/capture_reported_errors';

let counter = 0;

describe('connected', () => {
  it('invokes when element is already present', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div class="selector"></div>`);
    connected('.selector', callback);

    await nextFrame();
    expect(callback.calledOnceWith(root)).to.be.true;
  });

  it('invokes when element is added', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div></div>`);
    connected('#selector', callback);

    const element = document.createElement('div');
    element.setAttribute('id', 'selector');
    root.append(element);
    await nextFrame();
    expect(callback.calledOnceWith(element)).to.be.true;
  });

  it('invokes for the subject of a combinator selector added later', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<form></form>`);
    const stop = connected('form > button', callback);

    const button = document.createElement('button');
    root.append(button);
    await nextFrame();
    stop();
    expect(callback.calledOnceWith(button)).to.be.true;
  });

  it('invokes for every part of a selector list added later', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div></div>`);
    const stop = connected('span, b', callback);

    const span = document.createElement('span');
    const b = document.createElement('b');
    root.append(span, b);
    await nextFrame();
    stop();
    expect(callback.calledTwice).to.be.true;
    expect(callback.calledWith(span)).to.be.true;
    expect(callback.calledWith(b)).to.be.true;
  });

  it('invokes when the selector is added', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div></div>`);
    connected('.selector', callback);

    root.setAttribute('class', 'selector');
    await nextFrame();
    expect(callback.calledOnceWith(root)).to.be.true;
  });

  it('does not invoke if element does not match the selector', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div></div>`);
    connected('#selector', callback);

    const element = document.createElement('div');
    element.setAttribute('id', 'input');
    root.append(element);
    await nextFrame();
    expect(callback.called).to.be.false;
  });

  it('invokes the return function when element is removed', async () => {
    const connectedCallback = Sinon.spy();
    const disconnectedCallback = Sinon.spy();
    const root = await fixture(html`<div class="selector"></div>`);
    connected('.selector', (element) => {
      connectedCallback(element);
      return () => {
        disconnectedCallback(element);
      };
    });

    await nextFrame();
    expect(connectedCallback.calledOnceWith(root)).to.be.true;

    root.remove();
    await nextFrame();
    expect(disconnectedCallback.calledOnceWith(root)).to.be.true;
  });

  it('runs pending cleanups when stopped while elements are still connected', async () => {
    const cleanup = Sinon.spy();
    const root = await fixture(html`<div class="stop-cleanup"></div>`);
    const stop = connected('.stop-cleanup', () => cleanup);

    await nextFrame();
    expect(cleanup.called).to.be.false;

    stop();
    expect(cleanup.calledOnce).to.be.true;
    expect(root.isConnected).to.be.true;
  });

  it('runs each pending cleanup exactly once across removed and still-connected elements', async () => {
    const cleanup = Sinon.spy();
    const root = await fixture(html`
      <div>
        <div class="stop-mixed"></div>
        <div class="stop-mixed"></div>
      </div>
    `);
    const stop = connected('.stop-mixed', (element) => () => cleanup(element));
    const [removed, kept] = Array.from(root.querySelectorAll('.stop-mixed'));

    await nextFrame();
    removed.remove();
    await nextFrame();
    expect(cleanup.calledOnceWith(removed)).to.be.true;

    stop();
    expect(cleanup.calledTwice).to.be.true;
    expect(cleanup.calledWith(kept)).to.be.true;
  });

  it('stops observing even if a cleanup throws', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div><div class="stop-throws"></div></div>`);
    const stop = connected('.stop-throws', (element) => {
      callback(element);
      return () => {
        throw new Error('cleanup failed');
      };
    });

    await nextFrame();
    expect(callback.calledOnce).to.be.true;
    expect(stop).to.throw('cleanup failed');

    const late = document.createElement('div');
    late.classList.add('stop-throws');
    root.append(late);
    await nextFrame();
    expect(callback.calledOnce).to.be.true;
  });

  it('runs every pending cleanup even if an earlier one throws', async () => {
    const cleanup = Sinon.spy();
    const root = await fixture(html`
      <div>
        <div class="stop-partial"></div>
        <div class="stop-partial"></div>
      </div>
    `);
    const [first, second] = Array.from(root.querySelectorAll('.stop-partial'));
    const stop = connected('.stop-partial', (element) => () => {
      cleanup(element);
      if (element === first) throw new Error('first cleanup failed');
    });

    await nextFrame();
    expect(stop).to.throw('first cleanup failed');
    expect(cleanup.calledTwice).to.be.true;
    expect(cleanup.calledWith(second)).to.be.true;
  });

  it('does not rerun a cleanup on stop for an element already disconnected', async () => {
    const cleanup = Sinon.spy();
    const root = await fixture(html`<div class="stop-once"></div>`);
    const stop = connected('.stop-once', () => cleanup);

    await nextFrame();
    root.remove();
    await nextFrame();
    expect(cleanup.calledOnce).to.be.true;

    stop();
    expect(cleanup.calledOnce).to.be.true;
  });

  it('still invokes other watchers in the same batch when one callback throws', async () => {
    const good = Sinon.spy();
    const errors = captureReportedErrors('bad watcher');
    let stopBad = () => {};
    let stopGood = () => {};
    try {
      stopBad = connected('.batch-bad', () => {
        throw new Error('bad watcher');
      });
      stopGood = connected('.batch-good', good);
      const root = await fixture(html`<div></div>`);
      const bad = document.createElement('div');
      bad.className = 'batch-bad';
      const ok = document.createElement('div');
      ok.className = 'batch-good';
      root.append(bad, ok);
      await nextFrame();

      expect(errors.reported.length).to.eq(1);
      expect(good.calledOnceWith(ok)).to.be.true;
    } finally {
      stopBad();
      stopGood();
      errors.release();
    }
  });

  it('does not invoke when an attribute change makes a detached element match', async () => {
    const callback = Sinon.spy();
    const stop = connected('.detached-attr', callback);
    const element = await fixture(html`<div></div>`);

    element.remove();
    element.classList.add('detached-attr');
    await nextFrame();
    stop();
    expect(callback.called).to.be.false;
  });

  it('does not invoke when stopped', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div></div>`);
    const stop = connected('#selector', callback);

    stop();

    const element = document.createElement('div');
    element.setAttribute('id', 'selector');
    root.append(element);
    await nextFrame();
    expect(callback.called).to.be.false;
  });

  it('does not invoke the disconnected function when an unrelated attribute is removed', async () => {
    const disconnectedCallback = Sinon.spy();
    const root = await fixture(html`<div data-toggle="tooltip" title="Title"></div>`);
    connected('[data-toggle="tooltip"]', () => {
      return () => {
        disconnectedCallback();
      };
    });

    root.removeAttribute('title');
    await nextFrame();
    expect(disconnectedCallback.called).to.be.false;
  });

  it('invokes multiple cleanup functions', async () => {
    const disconnectedCallback = Sinon.spy();
    const root = await fixture(html`
      <div>
        <div class="element"></div>
        <div class="element"></div>
      </div>
    `);

    connected('.element', () => {
      return () => disconnectedCallback();
    });

    const elements = root.querySelectorAll<HTMLElement>('.element');
    elements[0].remove();
    elements[1].remove();
    await nextFrame();

    expect(disconnectedCallback.calledTwice).to.be.true;
  });
});

describe('shared observer', () => {
  it('does not create a new MutationObserver per connected() call', async () => {
    const observeSpy = Sinon.spy(MutationObserver.prototype, 'observe');
    try {
      const stops = [
        connected('.shared-a', () => {}),
        connected('.shared-b', () => {}),
        connected('.shared-c', () => {}),
        connected('.shared-d', () => {}),
        connected('.shared-e', () => {}),
      ];
      try {
        expect(observeSpy.callCount).to.be.at.most(1);
      } finally {
        stops.forEach((stop) => stop());
      }
    } finally {
      observeSpy.restore();
    }
  });
});

describe('disconnected', () => {
  it('invokes when element is removed', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div class="selector"></div>`);
    disconnected('.selector', callback);

    await nextFrame();
    expect(callback.called).to.be.false;

    root.remove();
    await nextFrame();
    expect(callback.calledOnceWith(root)).to.be.true;
  });

  it('invokes when the selector value is removed', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div class="selector"></div>`);
    disconnected('.selector', callback);

    root.setAttribute('class', '');
    await nextFrame();
    expect(callback.calledOnceWith(root)).to.be.true;
  });

  it('invokes when the selector itself is removed', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div class="selector"></div>`);
    disconnected('.selector', callback);

    root.removeAttribute('class');
    await nextFrame();
    expect(callback.calledOnceWith(root)).to.be.true;
  });

  it('does not invoke when stopped', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div class="selector"></div>`);
    const stop = disconnected('.selector', callback);

    stop();

    root.remove();
    await nextFrame();
    expect(callback.called).to.be.false;
  });

  it('does not invoke when an unrelated attribute is removed', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div data-toggle="tooltip" title="Title"></div>`);
    disconnected('[data-toggle="tooltip"]', callback);

    root.removeAttribute('title');
    await nextFrame();
    expect(callback.called).to.be.false;
  });
});

describe('whenInitialized', () => {
  const CONNECTION_TIMEOUT_MS = 200;

  it('resolves with the element when it is already initialized', async () => {
    counter += 1;
    const tag = `when-initialized-${counter}`;
    class WhenInitializedElement extends ImpulseElement {}
    registerElement(tag)(WhenInitializedElement);

    const element = document.createElement(tag) as WhenInitializedElement;
    document.body.appendChild(element);

    try {
      await waitUntil(() => element.hasAttribute('data-impulse-element'), 'element should initialize', {
        timeout: CONNECTION_TIMEOUT_MS,
      });
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
      // Called before `_asyncConnect` has set the marker attribute.
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
      const outcome = await Promise.race([
        promise.then(() => 'settled', () => 'settled'),
        new Promise((resolve) => setTimeout(resolve, 50, 'pending')),
      ]);
      expect(outcome).to.eq('pending');

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
});
