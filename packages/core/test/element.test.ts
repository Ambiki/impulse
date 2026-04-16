import { expect, waitUntil } from '@open-wc/testing';
import { ImpulseElement, property, registerElement, target } from '../src';

let counter = 0;

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
      await waitUntil(() => parent.capturedMessage !== '<unset>', 'childConnected should fire', { timeout: 200 });
      expect(parent.capturedMessage).to.eq('from-attribute');
    } finally {
      wrapper.remove();
    }
  });
});
