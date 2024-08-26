import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import Sinon from 'sinon';
import { AttributeObserver } from '../../src';

describe('AttributeObserver', () => {
  let el: HTMLElement;
  let observer: AttributeObserver;
  let delegate: {
    elementConnected: Sinon.SinonSpy;
    elementDisconnected: Sinon.SinonSpy;
    elementAttributeChanged: Sinon.SinonSpy;
  };

  beforeEach(async () => {
    el = await fixture(html`<div data-test="foo"><span></span></div>`);
    delegate = {
      elementConnected: Sinon.spy(),
      elementDisconnected: Sinon.spy(),
      elementAttributeChanged: Sinon.spy(),
    };
    observer = new AttributeObserver(el, 'data-test', delegate);
    observer.start();
  });

  afterEach(() => {
    observer?.stop();
  });

  it('calls elementConnected', () => {
    expect(delegate.elementConnected.calledOnce).to.eq(true);
  });

  it('calls elementDisconnected after removing the attribute', async () => {
    el.removeAttribute('data-test');
    await waitUntil(() => delegate.elementDisconnected.called);
    expect(delegate.elementDisconnected.calledOnce).to.eq(true);
  });

  it('calls elementAttributeChanged', async () => {
    el.setAttribute('data-test', 'bar');
    await waitUntil(() => delegate.elementConnected.called);
    expect(delegate.elementAttributeChanged.calledOnceWith(el, 'data-test')).to.eq(true);
  });

  it('calls elementConnected if attribute is added to a child element', async () => {
    const span = el.querySelector('span');
    span?.setAttribute('data-test', 'bar');
    await nextFrame();
    expect(delegate.elementConnected.calledTwice).to.eq(true);
  });

  it('calls elementDisconnected if child element is removed', async () => {
    const span = el.querySelector('span');
    span?.setAttribute('data-test', 'bar');
    await nextFrame();
    span?.remove();
    await nextFrame();
    expect(delegate.elementDisconnected.calledOnce).to.eq(true);
  });

  it('ignores other attributes', async () => {
    delegate.elementConnected.resetHistory();
    delegate.elementDisconnected.resetHistory();
    delegate.elementAttributeChanged.resetHistory();

    el.setAttribute('data-foo', 'bar');
    await nextFrame();
    expect(delegate.elementConnected.called).to.eq(false);
    expect(delegate.elementDisconnected.called).to.eq(false);
    expect(delegate.elementAttributeChanged.called).to.eq(false);
  });

  it('ignores elements whose attribute does not match', async () => {
    el.remove();
    await nextFrame();
    expect(delegate.elementDisconnected.called).to.eq(false);
  });
});
