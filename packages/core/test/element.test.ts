import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import Sinon from 'sinon';
import { ImpulseElement, property, registerElement, target } from '../src';
import { captureReportedErrors } from './support/capture_reported_errors';

let counter = 0;
const CONNECTION_TIMEOUT_MS = 200;

describe('ImpulseElement connection order', () => {
  it('waits for descendant custom elements to be defined before invoking targetConnected', async () => {
    counter += 1;
    const parentTag = `awaiter-parent-${counter}`;
    const childTag = `awaited-child-${counter}`;

    class Child extends ImpulseElement {
      @property({ type: String }) message = 'default';
    }

    class Parent extends ImpulseElement {
      @target() child!: Child;
      capturedMessage = '<unset>';
      childConnected(child: Child) {
        this.capturedMessage = child.message;
      }
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <${parentTag}>
        <${childTag} message="from-attribute" data-target="${parentTag}.child"></${childTag}>
      </${parentTag}>
    `;

    registerElement(parentTag)(Parent);
    document.body.appendChild(wrapper);

    // Yield so the parent's `_asyncConnect` has a chance to suspend at
    // `_resolveUndefinedElements()` before we register the child class.
    await new Promise((resolve) => setTimeout(resolve, 0));

    registerElement(childTag)(Child);

    try {
      const parent = wrapper.firstElementChild as Parent;
      await waitUntil(() => parent.capturedMessage !== '<unset>', 'childConnected should fire', { timeout: CONNECTION_TIMEOUT_MS });
      expect(parent.capturedMessage).to.eq('from-attribute');
    } finally {
      wrapper.remove();
    }
  });

  it('warns that the implicit descendant-definition wait is deprecated', async () => {
    counter += 1;
    const parentTag = `deprecation-parent-${counter}`;
    const childTag = `deprecation-child-${counter}`;
    const warn = Sinon.stub(console, 'warn');

    class Child extends ImpulseElement {}
    class Parent extends ImpulseElement {
      @target() child!: Child;
    }

    const wrapper = document.createElement('div');
    // The child class is intentionally never registered, so it stays undefined and the parent engages the wait.
    wrapper.innerHTML = `
      <${parentTag}>
        <${childTag} data-target="${parentTag}.child"></${childTag}>
      </${parentTag}>
    `;

    registerElement(parentTag)(Parent);
    document.body.appendChild(wrapper);

    try {
      await waitUntil(() => warn.called, 'deprecation warning should be emitted', { timeout: CONNECTION_TIMEOUT_MS });
      expect(warn.getCall(0).args[0]).to.include('whenInitialized');
    } finally {
      warn.restore();
      wrapper.remove();
    }
  });

  it('does not warn when migratedToWhenInitialized is set', async () => {
    counter += 1;
    const parentTag = `migrated-parent-${counter}`;
    const childTag = `migrated-child-${counter}`;
    const warn = Sinon.stub(console, 'warn');

    class Child extends ImpulseElement {}
    class Parent extends ImpulseElement {
      @target() child!: Child;
    }
    Parent.migratedToWhenInitialized = true;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <${parentTag}>
        <${childTag} data-target="${parentTag}.child"></${childTag}>
      </${parentTag}>
    `;

    registerElement(parentTag)(Parent);
    document.body.appendChild(wrapper);

    try {
      // Give `_asyncConnect` time to run past `_resolveUndefinedElements`.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(warn.called).to.be.false;
    } finally {
      warn.restore();
      wrapper.remove();
    }
  });

  it('makes @property accessors live synchronously on connect, before yielding to domReady', () => {
    counter += 1;
    const tag = `sync-property-${counter}`;

    class Element extends ImpulseElement {
      @property({ type: String }) message = 'default';
    }

    registerElement(tag)(Element);

    const element = document.createElement(tag) as Element & { message: string };
    element.setAttribute('message', 'from-attribute');
    document.body.appendChild(element);

    try {
      // `connectedCallback` runs synchronously inside `appendChild` (a [CEReactions] operation), and
      // `property.start()` is the first statement of `_asyncConnect`, before `await domReady()`. So the
      // attribute-backed getter must already be live here, with no `await`. This guards against a future
      // refactor moving `property.start()` back below the await, where this would read the raw field
      // default (`'default'`) because the accessor would not yet be defined.
      expect(element.message).to.eq('from-attribute');
    } finally {
      element.remove();
    }
  });

  it('reads a defined target child’s @property inside the connected callback', async () => {
    counter += 1;
    const parentTag = `defined-parent-${counter}`;
    const childTag = `defined-child-${counter}`;

    class Child extends ImpulseElement {
      @property({ type: String }) message = 'default';
    }

    class Parent extends ImpulseElement {
      @target() child!: Child;
      capturedMessage = '<unset>';
      childConnected(child: Child) {
        this.capturedMessage = child.message;
      }
    }

    // Both classes are registered up front, so the child is already defined at parse time and the
    // implicit `_resolveUndefinedElements` wait does not engage. The parent must still observe the
    // child's attribute-backed property because the child's accessors are defined synchronously on connect.
    registerElement(childTag)(Child);
    registerElement(parentTag)(Parent);

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <${parentTag}>
        <${childTag} message="from-attribute" data-target="${parentTag}.child"></${childTag}>
      </${parentTag}>
    `;
    document.body.appendChild(wrapper);

    try {
      const parent = wrapper.firstElementChild as Parent;
      await waitUntil(() => parent.capturedMessage !== '<unset>', 'childConnected should fire', {
        timeout: CONNECTION_TIMEOUT_MS,
      });
      expect(parent.capturedMessage).to.eq('from-attribute');
    } finally {
      wrapper.remove();
    }
  });

  it('adds the data-impulse-element attribute on connect and removes it on disconnect', async () => {
    counter += 1;
    const tag = `marker-element-${counter}`;

    class Element extends ImpulseElement {}

    registerElement(tag)(Element);

    const element = document.createElement(tag) as Element;
    document.body.appendChild(element);

    try {
      await waitUntil(() => element.hasAttribute('data-impulse-element'), 'attribute should be added on connect', {
        timeout: CONNECTION_TIMEOUT_MS,
      });
      expect(element.hasAttribute('data-impulse-element')).to.be.true;

      element.remove();
      expect(element.hasAttribute('data-impulse-element')).to.be.false;
    } finally {
      element.remove();
    }
  });
});

describe('ImpulseElement teardown', () => {
  it('still tears down and re-initializes on reconnect when disconnected() throws', async () => {
    counter += 1;
    const tag = `teardown-throws-${counter}`;
    class Element extends ImpulseElement {
      connectedSpy = Sinon.spy();
      connected() {
        this.connectedSpy();
      }

      disconnected() {
        throw new Error('disconnected failed');
      }
    }
    registerElement(tag)(Element);

    const element = document.createElement(tag) as Element;
    const errors = captureReportedErrors('disconnected failed');
    try {
      document.body.appendChild(element);
      await waitUntil(() => element.hasAttribute('data-impulse-element'), 'element should initialize', {
        timeout: CONNECTION_TIMEOUT_MS,
      });
      expect(element.connectedSpy.calledOnce).to.be.true;

      element.remove();
      expect(errors.reported.length).to.eq(1);
      expect(element.hasAttribute('data-impulse-element')).to.be.false;

      document.body.appendChild(element);
      await waitUntil(() => element.connectedSpy.calledTwice, 'element should re-initialize', {
        timeout: CONNECTION_TIMEOUT_MS,
      });
    } finally {
      element.remove();
      errors.release();
    }
  });

  it('re-creates the target watcher on reconnect when a target disconnected callback throws', async () => {
    counter += 1;
    const tag = `target-teardown-throws-${counter}`;
    class Element extends ImpulseElement {
      @target() panel!: HTMLElement;
      panelConnectedSpy = Sinon.spy();
      panelConnected() {
        this.panelConnectedSpy();
      }

      panelDisconnected() {
        throw new Error('panel disconnected failed');
      }
    }
    registerElement(tag)(Element);

    const element = document.createElement(tag) as Element;
    element.innerHTML = `<div data-target="${tag}.panel"></div>`;
    const errors = captureReportedErrors('panel disconnected failed');
    try {
      document.body.appendChild(element);
      await waitUntil(() => element.panelConnectedSpy.calledOnce, 'target should connect', {
        timeout: CONNECTION_TIMEOUT_MS,
      });

      element.remove();
      expect(errors.reported.length).to.eq(1);

      document.body.appendChild(element);
      await waitUntil(() => element.panelConnectedSpy.calledTwice, 'target should reconnect', {
        timeout: CONNECTION_TIMEOUT_MS,
      });
    } finally {
      element.remove();
      errors.release();
    }
  });
});

describe('ImpulseElement callback errors', () => {
  it('reports a duplicate @target and still finishes initializing', async () => {
    counter += 1;
    const tag = `duplicate-target-${counter}`;
    class Element extends ImpulseElement {
      @target() panel!: HTMLElement;
      connectedSpy = Sinon.spy();
      connected() {
        this.connectedSpy();
      }
    }
    registerElement(tag)(Element);

    const element = document.createElement(tag) as Element;
    element.innerHTML = `
      <div data-target="${tag}.panel"></div>
      <div data-target="${tag}.panel"></div>
    `;
    const errors = captureReportedErrors('Multiple "panel" targets');
    try {
      document.body.appendChild(element);
      await waitUntil(() => element.connectedSpy.calledOnce, 'element should initialize', {
        timeout: CONNECTION_TIMEOUT_MS,
      });
      expect(errors.reported.length).to.eq(1);
      expect(element.hasAttribute('data-impulse-element')).to.be.true;
      expect(element.panel).to.eq(element.querySelector('div'));
    } finally {
      element.remove();
      errors.release();
    }
  });
});

describe('ImpulseElement init races', () => {
  function createRaceElement(tag: string) {
    class RaceElement extends ImpulseElement {
      @target() panel!: HTMLElement;
      // Records whether the element was in the document when `connected()` ran.
      connectedSpy = Sinon.spy((_connected: boolean) => {});
      disconnectedSpy = Sinon.spy();
      panelConnectedSpy = Sinon.spy();
      connected() {
        this.connectedSpy(this.isConnected);
      }

      disconnected() {
        this.disconnectedSpy();
      }

      panelConnected() {
        this.panelConnectedSpy();
      }
    }
    registerElement(tag)(RaceElement);
    const element = document.createElement(tag) as RaceElement;
    element.innerHTML = `<div data-target="${tag}.panel"></div>`;
    return element;
  }

  it('initializes once when the element is moved synchronously, and still tears down normally', async () => {
    counter += 1;
    const element = createRaceElement(`race-move-${counter}`);
    const a = await fixture(html`<div></div>`);
    const b = await fixture(html`<div></div>`);

    a.append(element);
    b.append(element);
    await waitUntil(() => element.connectedSpy.called, 'element should initialize', { timeout: CONNECTION_TIMEOUT_MS });
    expect(element.connectedSpy.calledOnceWith(true)).to.be.true;
    expect(element.panelConnectedSpy.calledOnce).to.be.true;
    expect(element.hasAttribute('data-impulse-element')).to.be.true;

    element.remove();
    expect(element.disconnectedSpy.calledOnce).to.be.true;
    expect(element.hasAttribute('data-impulse-element')).to.be.false;
  });

  it('does not initialize when removed during async init, and initializes once when re-appended later', async () => {
    counter += 1;
    const element = createRaceElement(`race-detach-${counter}`);
    const a = await fixture(html`<div></div>`);

    a.append(element);
    element.remove();
    await nextFrame();
    await nextFrame();
    expect(element.connectedSpy.called).to.be.false;
    expect(element.panelConnectedSpy.called).to.be.false;
    expect(element.hasAttribute('data-impulse-element')).to.be.false;

    // Positive control: the bailed-out init left nothing behind, so a later reconnect initializes from scratch.
    a.append(element);
    await waitUntil(() => element.connectedSpy.called, 'element should initialize', { timeout: CONNECTION_TIMEOUT_MS });
    expect(element.connectedSpy.calledOnceWith(true)).to.be.true;
    expect(element.panelConnectedSpy.calledOnce).to.be.true;
    expect(element.hasAttribute('data-impulse-element')).to.be.true;
  });

  it('initializes once when removed and re-appended before init resumes', async () => {
    counter += 1;
    const element = createRaceElement(`race-reattach-${counter}`);
    const a = await fixture(html`<div></div>`);
    const b = await fixture(html`<div></div>`);

    a.append(element);
    element.remove();
    b.append(element);
    await waitUntil(() => element.connectedSpy.called, 'element should initialize', { timeout: CONNECTION_TIMEOUT_MS });

    expect(element.connectedSpy.calledOnceWith(true)).to.be.true;
    expect(element.hasAttribute('data-impulse-element')).to.be.true;
  });

  it('initializes once, connected, when re-appended after a bailed-out init', async () => {
    counter += 1;
    const element = createRaceElement(`race-late-reattach-${counter}`);
    const a = await fixture(html`<div></div>`);
    const b = await fixture(html`<div></div>`);

    a.append(element);
    element.remove();
    // Yield one microtask so the pending init resumes and bails before the element comes back. Clearing the in-flight
    // flag from a `.finally()` on the init promise would be one microtask late here and drop this reconnect.
    await Promise.resolve();
    b.append(element);
    await waitUntil(() => element.connectedSpy.called, 'element should initialize', { timeout: CONNECTION_TIMEOUT_MS });

    expect(element.connectedSpy.calledOnceWith(true)).to.be.true;
    expect(element.hasAttribute('data-impulse-element')).to.be.true;
  });
});
