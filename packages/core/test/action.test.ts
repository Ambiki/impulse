import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import Sinon from 'sinon';
import { ImpulseElement, registerElement } from '../src';

describe('action', () => {
  @registerElement('action-test')
  class ActionTestElement extends ImpulseElement {
    foo = Sinon.fake();
    toggle = Sinon.fake();
    focus = Sinon.fake();
  }

  let el: ActionTestElement;
  beforeEach(async () => {
    el = await fixture(html`
      <action-test data-action="foo->action-test#foo">
        <button type="button" data-action="click->action-test#toggle">Toggle</button>
        <div id="e2" data-action="click->action-test#toggle submit->action-test#focus"></div>
        <div id="e3" data-action="foo->unknown-element#foo"></div>
        <div id="e4" data-action="foo@window->action-test#foo"></div>
        <div id="e5" data-action="foo@document->action-test#foo"></div>
      </action-test>
    `);
  });

  it('calls the function', () => {
    const button = el.querySelector('button')!;
    expect(el.toggle).to.have.callCount(0);
    button.click();
    expect(el.toggle.calledOn(el)).to.be.true;
    expect(el.toggle).to.have.callCount(1);
    expect(el.toggle.getCall(0).args[0] instanceof Event).to.be.true;
  });

  it('calls the function that is bound to the element itself', () => {
    expect(el.foo).to.have.callCount(0);
    el.dispatchEvent(new CustomEvent('foo'));
    expect(el.foo).to.have.callCount(1);
  });

  it('can bind to multiple actions', () => {
    const element = el.querySelector('#e2')!;
    expect(el.toggle).to.have.callCount(0);
    expect(el.focus).to.have.callCount(0);
    element.dispatchEvent(new CustomEvent('click'));
    element.dispatchEvent(new CustomEvent('submit'));
    expect(el.toggle).to.have.callCount(1);
    expect(el.focus).to.have.callCount(1);
  });

  it('can bind to an action for an element that is dynamically added', async () => {
    expect(el.foo).to.have.callCount(0);
    const element = document.createElement('div');
    element.setAttribute('data-action', 'click->action-test#foo');
    el.append(element);
    await nextFrame();
    element.dispatchEvent(new CustomEvent('click'));
    expect(el.foo).to.have.callCount(1);
  });

  it('can update the action that is bound to a child element', async () => {
    const button = el.querySelector('button')!;
    expect(el.toggle).to.have.callCount(0);
    button.click();
    expect(el.toggle).to.have.callCount(1);
    button.setAttribute('data-action', 'foo->action-test#toggle');
    await nextFrame();
    button.click();
    expect(el.toggle).to.have.callCount(1);
    button.dispatchEvent(new CustomEvent('foo'));
    expect(el.toggle).to.have.callCount(2);
  });

  it('can update the action that is bound to the element itself', async () => {
    expect(el.foo).to.have.callCount(0);
    el.setAttribute('data-action', 'bar->action-test#foo');
    // We need to wait for the next animtation frame so that the action can be binded to the element.
    await nextFrame();
    el.dispatchEvent(new CustomEvent('foo'));
    expect(el.foo).to.have.callCount(0);
    el.dispatchEvent(new CustomEvent('bar'));
    expect(el.foo).to.have.callCount(1);
  });

  it('can bind action to window', () => {
    expect(el.foo).to.have.callCount(0);
    window.dispatchEvent(new CustomEvent('foo'));
    expect(el.foo).to.have.callCount(1);
  });

  it('can bind action to document', () => {
    expect(el.foo).to.have.callCount(0);
    document.dispatchEvent(new CustomEvent('foo'));
    expect(el.foo).to.have.callCount(1);
  });

  it('does not bind actions if identifier does not match', () => {
    const element = el.querySelector('#e3')!;
    expect(el.foo).to.have.callCount(0);
    element.dispatchEvent(new CustomEvent('foo'));
    expect(el.foo).to.have.callCount(0);
  });
});
