import { expect, fixture, html } from '@open-wc/testing';
import { ImpulseElement, registerElement } from '../src';
import Sinon from 'sinon';

describe('action listeners', () => {
  @registerElement('action-listener-test')
  class ActionListenerTest extends ImpulseElement {
    toggle = Sinon.spy();
  }

  let el: ActionListenerTest;
  beforeEach(async () => {
    el = await fixture<ActionListenerTest>(html`
      <action-listener-test>
        <button id="button1" type="button" data-action="click.once->action-listener-test#toggle"></button>
      </action-listener-test>
    `);
  });

  it('once option', () => {
    const button = el.querySelector<HTMLButtonElement>('#button1')!;

    button.click();
    expect(el.toggle.calledOnce).to.be.true;

    el.toggle.resetHistory();
    button.click();
    expect(el.toggle.called).to.be.false;
  });
});
