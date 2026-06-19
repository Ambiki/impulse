import { expect, waitUntil } from '@open-wc/testing';
import Sinon from 'sinon';
import { ImpulseElement, property, registerElement, target } from '../src';

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
