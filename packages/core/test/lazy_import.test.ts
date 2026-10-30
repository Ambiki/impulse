import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import Sinon from 'sinon';
import { lazyImport } from '../src';

describe('lazy import', () => {
  it('calls the callback immediately if the element is present in the DOM', async () => {
    const callback = Sinon.spy();
    lazyImport('lazy-define-1', callback);
    lazyImport('lazy-define-2', callback);
    lazyImport('#card-form', callback);
    lazyImport('.js-card', callback);
    await fixture(html`<lazy-define-1></lazy-define-1>`);
    await fixture(html`<lazy-define-2></lazy-define-2>`);
    await fixture(html`<div id="card-form"></div>`);
    await fixture(html`<div class="js-card"></div>`);

    await nextFrame();
    expect(callback.callCount).to.eq(4);
  });

  it('does not call the same callback multiple times for the same element', async () => {
    const callback = Sinon.spy();
    lazyImport('lazy-define-multiple', callback);
    lazyImport('lazy-define-multiple', callback);
    await fixture(html`<lazy-define-multiple></lazy-define-multiple>`);

    await nextFrame();
    expect(callback.calledOnce).to.be.true;
  });

  it('calls the callback for dynamically added elements', async () => {
    const callback = Sinon.spy();
    lazyImport('lazy-define-dynamic', callback);
    const el = await fixture(html`<div></div>`);

    const element = document.createElement('lazy-define-dynamic');
    el.append(element);

    await nextFrame();
    expect(callback.calledOnce).to.be.true;
  });

  it('calls only the callback whose selector matches an element on the page', async () => {
    const callbackA = Sinon.spy();
    const callbackB = Sinon.spy();
    lazyImport('.lazy-only-a', callbackA);
    lazyImport('.lazy-only-b', callbackB);
    await fixture(html`<div class="lazy-only-a"></div>`);

    await nextFrame();
    expect(callbackA.calledOnce).to.be.true;
    expect(callbackB.called).to.be.false;
  });
});
