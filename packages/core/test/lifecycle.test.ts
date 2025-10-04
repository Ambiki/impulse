import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import Sinon from 'sinon';
import { onConnected } from '../src';

describe('onConnected', () => {
  it('invokes when element is already present', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div class="selector"></div>`);
    onConnected('.selector', callback);

    await nextFrame();
    expect(callback.calledOnceWith(root)).to.be.true;
  });

  it('invokes when element is added', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div></div>`);
    onConnected('#selector', callback);

    const element = document.createElement('div');
    element.setAttribute('id', 'selector');
    root.append(element);
    await nextFrame();
    expect(callback.calledOnceWith(element)).to.be.true;
  });

  it('invokes when the selector is added', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div></div>`);
    onConnected('.selector', callback);

    root.setAttribute('class', 'selector');
    await nextFrame();
    expect(callback.calledOnceWith(root)).to.be.true;
  });

  it('does not invoke when the selector is added', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div></div>`);
    onConnected('.selector', callback, { attributes: false });

    root.setAttribute('class', 'selector');
    await nextFrame();
    expect(callback.called).to.be.false;
  });

  it('does not invoke if element does not match the selector', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div></div>`);
    onConnected('#selector', callback);

    const element = document.createElement('div');
    element.setAttribute('id', 'input');
    root.append(element);
    await nextFrame();
    expect(callback.called).to.be.false;
  });

  it('invokes the return function when element is removed', async () => {
    const connected = Sinon.spy();
    const disconnected = Sinon.spy();
    const root = await fixture(html`<div class="selector"></div>`);
    onConnected('.selector', (element) => {
      connected(element);
      return () => {
        disconnected(element);
      };
    });

    await nextFrame();
    expect(connected.calledOnceWith(root)).to.be.true;

    root.remove();
    await nextFrame();
    expect(disconnected.calledOnceWith(root)).to.be.true;
  });
});
