import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import Sinon from 'sinon';
import { ImpulseElement, registerElement } from '../src';

describe('action', () => {
  @registerElement('action-test')
  class ActionTest extends ImpulseElement {
    toggle = Sinon.spy();
    keydown = Sinon.spy();
    foo = Sinon.spy();
  }

  let el: ActionTest;
  beforeEach(async () => {
    el = await fixture(html`
      <action-test data-action="instanceAction->action-test#foo">
        <button
          id="button1"
          type="button"
          data-action="click->action-test#toggle keydown->action-test#keydown"
        ></button>
        <button id="button2" type="button" data-action="click->action-test#toggle"></button>
        <div id="element1" data-action="foo@window->action-test#foo"></div>
        <div id="element2" data-action="foo@document->action-test#foo"></div>
        <div id="element3" data-action="click->invalid-test#toggle"></div>
        <action-test>
          <button id="nested-button1" type="button" data-action="click->action-test#toggle"></button>
        </action-test>
      </action-test>
    `);
  });

  it('should call the function', () => {
    const button = el.querySelector<HTMLButtonElement>('#button1')!;
    button.click();
    expect(el.toggle.calledOnce).to.be.true;
    expect(el.toggle.calledOn(el)).to.be.true;
    expect(el.keydown.notCalled).to.be.true;

    button.click();
    expect(el.toggle.calledTwice).to.be.true;
  });

  it('should bind to multiple actions', async () => {
    const button = el.querySelector<HTMLButtonElement>('#button1')!;
    button.focus();
    await sendKeys({ press: 'Enter' });

    expect(el.keydown.calledOnce).to.be.true;
    expect(el.keydown.calledOn(el)).to.be.true;
  });

  it('should bind action to the instance itself', () => {
    el.dispatchEvent(new CustomEvent('instanceAction'));

    expect(el.foo.calledOnce).to.be.true;
  });

  it('should bind to an action for an element that is inserted into the DOM', async () => {
    const element = document.createElement('div');
    element.classList.add('dynamic');
    element.setAttribute('data-action', `click->${el.identifier}#foo`);
    el.append(element);

    await waitUntil(() => el.querySelector('.dynamic'));
    element.click();
    expect(el.foo.calledOnce).to.be.true;
  });

  it('should bind to an updated action', async () => {
    const button = el.querySelector<HTMLButtonElement>('#button2')!;
    button.click();
    expect(el.toggle.calledOnce).to.be.true;

    el.toggle.resetHistory();
    button.setAttribute('data-action', `keydown->${el.identifier}#keydown`);
    await waitUntil(() => button.getAttribute('data-action') === `keydown->${el.identifier}#keydown`);
    button.click();
    expect(el.toggle.notCalled).to.be.true;

    button.focus();
    await sendKeys({ press: 'Enter' });
    expect(el.keydown.calledOnce).to.be.true;
  });

  it('should bind action to the window', () => {
    window.dispatchEvent(new CustomEvent('foo'));
    expect(el.foo.calledOnce).to.be.true;
  });

  it('should bind action to the document', () => {
    document.dispatchEvent(new CustomEvent('foo'));
    expect(el.foo.calledOnce).to.be.true;
  });

  it('should not bind action if the identifier does not match', () => {
    const element = document.querySelector<HTMLElement>('#element3')!;
    element.click();

    expect(el.toggle.notCalled).to.be.true;
  });

  it('should call the child action but avoid calling the parent action', () => {
    const el2 = el.querySelector<ActionTest>('action-test')!;
    const button = el2.querySelector<HTMLButtonElement>('#nested-button1')!;
    button.click();

    expect(el2.toggle.calledOnce).to.be.true;
    expect(el.toggle.notCalled).to.be.true;
  });

  it('should call the child action but avoid calling the parent action for an inserted element', async () => {
    const el2 = el.querySelector<ActionTest>('action-test')!;
    const element = document.createElement('div')!;
    element.classList.add('dynamic');
    element.setAttribute('data-action', `foo->${el2.identifier}#foo`);
    el2.append(element);
    await waitUntil(() => el2.querySelector('.dynamic'));
    element.dispatchEvent(new CustomEvent('foo'));

    expect(el2.foo.calledOnce).to.be.true;
    expect(el.foo.notCalled).to.be.true;
  });
});
