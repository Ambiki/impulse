import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import Sinon from 'sinon';
import { ImpulseElement, registerElement } from '../src';

describe('action listeners', () => {
  @registerElement('action-listener-test')
  class ActionListenerTest extends ImpulseElement {
    toggle = Sinon.spy();
    capturing = Sinon.spy();
    bubbling = Sinon.spy();
    prevent = Sinon.spy();
  }

  let el: ActionListenerTest;
  beforeEach(async () => {
    el = await fixture<ActionListenerTest>(html`
      <action-listener-test>
        <button id="button1" type="button" data-action="click.once->action-listener-test#toggle"></button>
        <div id="capture" data-action="click.capture->action-listener-test#capturing">
          <button id="inner" type="button" data-action="click->action-listener-test#bubbling"></button>
        </div>
        <div id="passive" data-action="cancel.passive.prevent->action-listener-test#prevent"></div>
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

  it('capture option', async () => {
    const capture = el.querySelector<HTMLElement>('#capture')!;
    el.querySelector<HTMLButtonElement>('#inner')!.click();
    expect(el.capturing.calledOnce).to.be.true;
    expect(el.capturing.calledBefore(el.bubbling)).to.be.true;

    // Removed with the options it was added with, or the capturing listener would be left behind.
    capture.removeAttribute('data-action');
    await nextFrame();
    el.capturing.resetHistory();
    el.querySelector<HTMLButtonElement>('#inner')!.click();
    expect(el.capturing.called).to.be.false;
  });

  it('passive option', () => {
    const event = new Event('cancel', { cancelable: true });
    el.querySelector<HTMLElement>('#passive')!.dispatchEvent(event);

    expect(el.prevent.calledOnce).to.be.true;
    expect(event.defaultPrevented).to.be.false;
  });
});
