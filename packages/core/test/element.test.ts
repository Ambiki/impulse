import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import Sinon from 'sinon';
import { ImpulseElement, property, registerElement, target, whenInitialized } from '../src';
import { captureReportedErrors } from './support/capture_reported_errors';
import { simulateParsing } from './support/parsing';

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

    // Yield so the parent's init has a chance to reach the descendant wait before we register the child class.
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
      // Give the init time to run past the descendant wait.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(warn.called).to.be.false;
    } finally {
      warn.restore();
      wrapper.remove();
    }
  });

  it('initializes once a customized built-in descendant is defined', async () => {
    counter += 1;
    const parentTag = `built-in-parent-${counter}`;
    const buttonName = `built-in-button-${counter}`;

    class Parent extends ImpulseElement {
      @target() button!: HTMLButtonElement;
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <${parentTag}>
        <button is="${buttonName}" data-target="${parentTag}.button"></button>
      </${parentTag}>
    `;

    registerElement(parentTag)(Parent);
    document.body.appendChild(wrapper);

    // Yield so the parent's init has a chance to reach the descendant wait before the button is defined.
    await new Promise((resolve) => setTimeout(resolve, 0));

    customElements.define(buttonName, class extends HTMLButtonElement {}, { extends: 'button' });

    try {
      const parent = await whenInitialized(wrapper.firstElementChild as Parent, { timeout: CONNECTION_TIMEOUT_MS });
      expect(parent.button).to.eq(wrapper.querySelector('button'));
    } finally {
      wrapper.remove();
    }
  });

  it('waits for a customized built-in descendant to be defined before invoking targetConnected', async function () {
    counter += 1;
    const parentTag = `built-in-awaiter-${counter}`;
    const buttonName = `built-in-awaited-${counter}`;

    class Button extends HTMLButtonElement {
      get label() {
        return 'from-definition';
      }
    }

    class Parent extends ImpulseElement {
      @target() button!: Button;
      capturedLabel = '<unset>';
      buttonConnected(button: Button) {
        this.capturedLabel = button.label;
      }
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <${parentTag}>
        <button is="${buttonName}" data-target="${parentTag}.button"></button>
      </${parentTag}>
    `;

    registerElement(parentTag)(Parent);
    document.body.appendChild(wrapper);

    // Yield so the parent's init has a chance to reach the descendant wait before the button is defined.
    await new Promise((resolve) => setTimeout(resolve, 0));

    customElements.define(buttonName, Button, { extends: 'button' });

    try {
      // WebKit does not implement customized built-ins: the button is never undefined there, and never upgraded.
      if (!(wrapper.querySelector('button') instanceof Button)) this.skip();

      const parent = wrapper.firstElementChild as Parent;
      await waitUntil(() => parent.capturedLabel !== '<unset>', 'buttonConnected should fire', { timeout: CONNECTION_TIMEOUT_MS });
      expect(parent.capturedLabel).to.eq('from-definition');
    } finally {
      wrapper.remove();
    }
  });

  it('initializes once a descendant custom element with an is attribute is defined', async () => {
    counter += 1;
    const parentTag = `is-attribute-parent-${counter}`;
    const childTag = `is-attribute-child-${counter}`;

    class Parent extends ImpulseElement {
      @target() child!: HTMLElement;
    }

    const wrapper = document.createElement('div');
    // Nothing is ever defined under the child's `is`: defining its tag name is what defines it.
    wrapper.innerHTML = `
      <${parentTag}>
        <${childTag} is="never-defined-${counter}" data-target="${parentTag}.child"></${childTag}>
      </${parentTag}>
    `;

    registerElement(parentTag)(Parent);
    document.body.appendChild(wrapper);

    // Yield so the parent's init has a chance to reach the descendant wait before the child is defined.
    await new Promise((resolve) => setTimeout(resolve, 0));

    customElements.define(childTag, class extends HTMLElement {});

    try {
      const parent = await whenInitialized(wrapper.firstElementChild as Parent, { timeout: CONNECTION_TIMEOUT_MS });
      expect(parent.child).to.eq(wrapper.querySelector(childTag));
    } finally {
      wrapper.remove();
    }
  });

  it('initializes with a customized built-in descendant whose is was not set by an attribute', async () => {
    counter += 1;
    const parentTag = `is-option-parent-${counter}`;
    const warn = Sinon.stub(console, 'warn');

    class Parent extends ImpulseElement {
      @target() button!: HTMLButtonElement;
    }

    registerElement(parentTag)(Parent);

    // `createElement()` records the name without writing an `is` attribute, so nothing on the button says which
    // definition it is waiting for.
    const button = document.createElement('button', { is: `is-option-button-${counter}` });
    button.setAttribute('data-target', `${parentTag}.button`);
    const parent = document.createElement(parentTag) as Parent;
    parent.append(button);
    document.body.append(parent);

    try {
      await whenInitialized(parent, { timeout: CONNECTION_TIMEOUT_MS });
      expect(parent.button).to.eq(button);
      // There was no wait to warn about.
      expect(warn.called).to.be.false;
    } finally {
      warn.restore();
      parent.remove();
    }
  });

  it('initializes with a descendant whose is can never name a definition', async () => {
    counter += 1;
    const parentTag = `invalid-is-parent-${counter}`;
    const warn = Sinon.stub(console, 'warn');

    class Parent extends ImpulseElement {
      @target() row!: HTMLElement;
    }

    const wrapper = document.createElement('div');
    // Vue's in-DOM templates write `is="vue:…"`, which is not a name the registry accepts.
    wrapper.innerHTML = `
      <${parentTag}>
        <div is="vue:row" data-target="${parentTag}.row"></div>
      </${parentTag}>
    `;

    registerElement(parentTag)(Parent);
    document.body.appendChild(wrapper);

    try {
      const parent = await whenInitialized(wrapper.firstElementChild as Parent, { timeout: CONNECTION_TIMEOUT_MS });
      expect(parent.row).to.eq(wrapper.querySelector('[is]'));
    } finally {
      warn.restore();
      wrapper.remove();
    }
  });

  it('makes @property accessors live synchronously on connect, before yielding to whenParsed', () => {
    counter += 1;
    const tag = `sync-property-${counter}`;

    class TestElement extends ImpulseElement {
      @property({ type: String }) message = 'default';
    }

    registerElement(tag)(TestElement);

    const element = document.createElement(tag) as TestElement & { message: string };
    element.setAttribute('message', 'from-attribute');
    document.body.appendChild(element);

    try {
      // `connectedCallback` runs synchronously inside `appendChild` (a [CEReactions] operation), and the properties
      // Step is the first Step, ahead of the Parsed wait. So the attribute-backed getter must already be live here,
      // with no `await`. This guards against a future refactor moving that Step below the wait, where this would read
      // the raw field default (`'default'`) because the accessor would not yet be defined.
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

    class TestElement extends ImpulseElement {}

    registerElement(tag)(TestElement);

    const element = document.createElement(tag) as TestElement;
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

describe('ImpulseElement before the document is Parsed', () => {
  it('does not initialize until the document is Parsed', async () => {
    counter += 1;
    const tag = `parsing-element-${counter}`;
    const connectedSpy = Sinon.spy();

    class TestElement extends ImpulseElement {
      connected() {
        connectedSpy();
      }
    }

    registerElement(tag)(TestElement);
    const finishParsing = simulateParsing();
    const element = document.createElement(tag);
    document.body.appendChild(element);

    try {
      await nextFrame();
      expect(connectedSpy.called).to.be.false;

      finishParsing();
      await waitUntil(() => connectedSpy.called, 'connected() should run once the document is Parsed', {
        timeout: CONNECTION_TIMEOUT_MS,
      });
      expect(connectedSpy.calledOnce).to.be.true;
    } finally {
      finishParsing();
      element.remove();
    }
  });
});

describe('ImpulseElement teardown', () => {
  it('still tears down and re-initializes on reconnect when disconnected() throws', async () => {
    counter += 1;
    const tag = `teardown-throws-${counter}`;
    class TestElement extends ImpulseElement {
      connectedSpy = Sinon.spy();
      connected() {
        this.connectedSpy();
      }

      disconnected() {
        throw new Error('disconnected failed');
      }
    }
    registerElement(tag)(TestElement);

    const element = document.createElement(tag) as TestElement;
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
    class TestElement extends ImpulseElement {
      @target() panel!: HTMLElement;
      panelConnectedSpy = Sinon.spy();
      panelConnected() {
        this.panelConnectedSpy();
      }

      panelDisconnected() {
        throw new Error('panel disconnected failed');
      }
    }
    registerElement(tag)(TestElement);

    const element = document.createElement(tag) as TestElement;
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

  // The teardown keeps reporting property changes until its steps have run. Switching that off as the teardown begins,
  // ahead of `disconnected()`, would drop this call.
  it('invokes [property]Changed for an attribute that disconnected() changes', async () => {
    counter += 1;
    const tag = `teardown-property-${counter}`;
    class TestElement extends ImpulseElement {
      @property() state = 'open';
      stateChanged = Sinon.fake();
      disconnected() {
        this.state = 'closed';
      }
    }
    registerElement(tag)(TestElement);

    const element = document.createElement(tag) as TestElement;
    document.body.append(element);
    try {
      await whenInitialized(element);
      element.remove();
      expect(element.stateChanged.calledOnceWith('closed', 'open')).to.be.true;
    } finally {
      element.remove();
    }
  });

  it('initializes a moved element once when disconnected() changes a property', async () => {
    counter += 1;
    const tag = `teardown-move-property-${counter}`;
    const connectedSpy = Sinon.spy();
    const disconnectedSpy = Sinon.spy();
    class TestElement extends ImpulseElement {
      @property() state = 'open';
      connected() {
        connectedSpy();
      }

      // Changing an observed attribute queues a reaction on the element. Chromium and Firefox then run the move's own
      // `connectedCallback` inside the teardown rather than after it; WebKit still runs it after.
      disconnected() {
        disconnectedSpy();
        this.state = 'closed';
      }
    }
    registerElement(tag)(TestElement);

    const a = await fixture(html`<div></div>`);
    const b = await fixture(html`<div></div>`);
    const element = document.createElement(tag) as TestElement;
    a.append(element);
    await waitUntil(() => connectedSpy.calledOnce, 'element should initialize', { timeout: CONNECTION_TIMEOUT_MS });

    b.append(element);
    await waitUntil(() => connectedSpy.calledTwice, 'element should re-initialize', { timeout: CONNECTION_TIMEOUT_MS });
    await nextFrame();
    expect(connectedSpy.calledTwice).to.be.true;
    expect(disconnectedSpy.calledOnce).to.be.true;
    expect(element.hasAttribute('data-impulse-element')).to.be.true;
  });
});

describe('ImpulseElement callback errors', () => {
  it('reports a duplicate @target and still finishes initializing', async () => {
    counter += 1;
    const tag = `duplicate-target-${counter}`;
    class TestElement extends ImpulseElement {
      @target() panel!: HTMLElement;
      connectedSpy = Sinon.spy();
      connected() {
        this.connectedSpy();
      }
    }
    registerElement(tag)(TestElement);

    const element = document.createElement(tag) as TestElement;
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
  // The rules these tests touch are covered on their own by the scripted tests in `lifecycle.test.ts`. These check that
  // an element reaches them through its real reactions, with its targets and actions.
  function createRaceElement(tag: string) {
    class RaceElement extends ImpulseElement {
      @target() panel!: HTMLElement;
      // Records whether the element was in the document when `connected()` ran.
      connectedSpy = Sinon.spy((_connected: boolean) => {});
      panelConnectedSpy = Sinon.spy();
      connected() {
        this.connectedSpy(this.isConnected);
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

  it('re-initializes at the new position when connected() moves the element', async () => {
    counter += 1;
    const tag = `race-teleport-${counter}`;
    const toastsId = `toasts-${counter}`;
    const inlineId = `inline-${counter}`;
    const handled = Sinon.spy();
    const connectedParents: Array<string | undefined> = [];
    const disconnectedSpy = Sinon.spy();

    class TeleportElement extends ImpulseElement {
      @target() button!: HTMLButtonElement;

      connected() {
        connectedParents.push(this.parentElement?.id);
        const region = document.getElementById(toastsId)!;
        if (this.parentElement !== region) region.append(this);
      }

      disconnected() {
        disconnectedSpy();
      }

      handle() {
        handled();
      }
    }
    registerElement(tag)(TeleportElement);

    const root = await fixture(html`<div><div id="${toastsId}"></div><div id="${inlineId}"></div></div>`);
    const element = document.createElement(tag) as TeleportElement;
    element.innerHTML = `<button data-target="${tag}.button" data-action="click->${tag}#handle"></button>`;
    root.querySelector(`#${inlineId}`)!.append(element);
    await waitUntil(() => connectedParents.length === 2, 'element should re-initialize after moving', {
      timeout: CONNECTION_TIMEOUT_MS,
    });

    expect(connectedParents).to.deep.eq([inlineId, toastsId]);
    expect(disconnectedSpy.calledOnce).to.be.true;
    expect(element.parentElement!.id).to.eq(toastsId);
    expect(element.hasAttribute('data-impulse-element')).to.be.true;
    expect(await whenInitialized(element)).to.eq(element);
    expect(element.button).to.eq(element.querySelector('button'));
    element.button.click();
    expect(handled.calledOnce).to.be.true;
  });
});

describe('ImpulseElement watcher sharing', () => {
  it('matches an inserted node against a shared watcher once, however many instances are live', async () => {
    counter += 1;
    const tag = `shared-watcher-${counter}`;
    class SharedWatcherElement extends ImpulseElement {
      @target() panel!: HTMLElement;
      panelConnectedSpy = Sinon.spy();
      toggle = Sinon.spy();
      panelConnected() {
        this.panelConnectedSpy();
      }
    }
    registerElement(tag)(SharedWatcherElement);

    const root = await fixture(html`<div></div>`);
    const instances: SharedWatcherElement[] = [];
    for (let i = 0; i < 5; i += 1) {
      const element = document.createElement(tag) as SharedWatcherElement;
      element.innerHTML = `<div data-target="${tag}.panel" data-action="click->${tag}#toggle"></div>`;
      root.append(element);
      instances.push(element);
    }
    await waitUntil(() => instances.every((element) => element.panelConnectedSpy.calledOnce), 'targets connect', {
      timeout: CONNECTION_TIMEOUT_MS,
    });

    const matches = Sinon.spy(Element.prototype, 'matches');
    try {
      const inserted = document.createElement('div');
      inserted.setAttribute('data-action', `click->${tag}#toggle`);
      instances[2].append(document.createElement('span'));
      instances[2].append(inserted);
      await nextFrame();
      const selectors = matches.args.map(([selector]) => selector);
      expect(selectors.filter((selector) => selector === '[data-action]').length).to.eq(1);
      // The index keys each watcher on the attribute its selector names, so a node without that attribute - the
      // inserted div for `[data-target]`, the bare span for both - is never tested against it at all.
      expect(selectors.filter((selector) => selector === '[data-target]').length).to.eq(0);
    } finally {
      matches.restore();
    }

    // The routed listener still lands on the right instance.
    instances[2].querySelector<HTMLElement>('div:last-child')!.click();
    expect(instances[2].toggle.calledOnce).to.be.true;
    const others = instances.filter((element) => element !== instances[2]);
    expect(others.every((element) => element.toggle.notCalled)).to.be.true;
  });
});
