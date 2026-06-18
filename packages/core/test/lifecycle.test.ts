import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import Sinon from 'sinon';
import { connected, disconnected, ImpulseElement, registerElement, whenInitialized } from '../src';

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
    class Element extends ImpulseElement {}
    registerElement(tag)(Element);

    const element = document.createElement(tag) as Element;
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
    class Element extends ImpulseElement {}
    registerElement(tag)(Element);

    const element = document.createElement(tag) as Element;
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
    class Element extends ImpulseElement {}

    // Create and attach the element before its class is defined.
    const element = document.createElement(tag) as Element;
    document.body.appendChild(element);

    try {
      const promise = whenInitialized(element);
      registerElement(tag)(Element);
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

  it('rejects when a custom element is not initialized within the timeout', async () => {
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
