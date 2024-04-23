import { expect, fixture, html } from '@open-wc/testing';
import { ImpulseElement, registerElement } from '../src';
import Sinon from 'sinon';

describe('action modifiers', () => {
  @registerElement('action-modifier-test')
  class ActionModifierTest extends ImpulseElement {
    elSpy = Sinon.spy();
    toggleSpy = Sinon.spy();
    stopSpy = Sinon.spy();

    connected() {
      this.addEventListener('click', this.toggleSpy);
    }
  }

  let el: ActionModifierTest;
  beforeEach(async () => {
    el = await fixture<ActionModifierTest>(html`
      <action-modifier-test data-action="click.self->action-modifier-test#elSpy">
        <button id="button1" type="button" data-action="click.prevent->action-modifier-test#toggleSpy"></button>
        <button id="button2" type="button" data-action="click.stop->action-modifier-test#stopSpy"></button>
        <button id="button3" type="button" data-action="click.prevent.stop->action-modifier-test#stopSpy"></button>
        <button id="button4" type="button" data-action="click->action-modifier-test#toggleSpy"></button>
      </action-modifier-test>
    `);
  });

  it('prevent modifier', () => {
    const button = el.querySelector<HTMLButtonElement>('#button1')!;
    button.click();

    expect(el.toggleSpy.args[0][0].defaultPrevented).to.be.true;
  });

  it('stop modifier', () => {
    const button = el.querySelector<HTMLButtonElement>('#button2')!;
    button.click();

    expect(el.toggleSpy.called).to.be.false;
    expect(el.stopSpy.calledOnce).to.be.true;
  });

  it('self modifier', () => {
    const button = el.querySelector<HTMLButtonElement>('#button4')!;
    button.click();

    // called by the element and the button
    expect(el.toggleSpy.calledTwice).to.be.true;
    // not called because button is clicked and not the element.
    expect(el.elSpy.called).to.be.false;

    el.click();
    expect(el.elSpy.calledOnce).to.be.true;
  });

  it('chaining multiple modifiers', () => {
    const button = el.querySelector<HTMLButtonElement>('#button3')!;
    button.click();

    expect(el.toggleSpy.called).to.be.false;
    expect(el.stopSpy.calledOnce).be.true;
    expect(el.stopSpy.args[0][0].defaultPrevented).to.be.true;
  });
});
