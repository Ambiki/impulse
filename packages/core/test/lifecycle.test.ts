import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import Sinon from 'sinon';
import { connected, disconnected } from '../src';

describe('connected', () => {
  it('invokes when element is already present', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div class="selector"></div>`);
    connected('.selector', callback);

    await nextFrame();
    expect(callback.calledOnceWith(root)).to.be.true;
  });

  it('invokes when element is added', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div></div>`);
    connected('#selector', callback);

    const element = document.createElement('div');
    element.setAttribute('id', 'selector');
    root.append(element);
    await nextFrame();
    expect(callback.calledOnceWith(element)).to.be.true;
  });

  it('invokes when the selector is added', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div></div>`);
    connected('.selector', callback);

    root.setAttribute('class', 'selector');
    await nextFrame();
    expect(callback.calledOnceWith(root)).to.be.true;
  });

  it('does not invoke if element does not match the selector', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div></div>`);
    connected('#selector', callback);

    const element = document.createElement('div');
    element.setAttribute('id', 'input');
    root.append(element);
    await nextFrame();
    expect(callback.called).to.be.false;
  });

  it('invokes the return function when element is removed', async () => {
    const connectedCallback = Sinon.spy();
    const disconnectedCallback = Sinon.spy();
    const root = await fixture(html`<div class="selector"></div>`);
    connected('.selector', (element) => {
      connectedCallback(element);
      return () => {
        disconnectedCallback(element);
      };
    });

    await nextFrame();
    expect(connectedCallback.calledOnceWith(root)).to.be.true;

    root.remove();
    await nextFrame();
    expect(disconnectedCallback.calledOnceWith(root)).to.be.true;
  });

  it('does not invoke when stopped', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div></div>`);
    const stop = connected('#selector', callback);

    stop();

    const element = document.createElement('div');
    element.setAttribute('id', 'selector');
    root.append(element);
    await nextFrame();
    expect(callback.called).to.be.false;
  });

  it('does not invoke the disconnected function when an unrelated attribute is removed', async () => {
    const disconnectedCallback = Sinon.spy();
    const root = await fixture(html`<div data-toggle="tooltip" title="Title"></div>`);
    connected('[data-toggle="tooltip"]', () => {
      return () => {
        disconnectedCallback();
      };
    });

    root.removeAttribute('title');
    await nextFrame();
    expect(disconnectedCallback.called).to.be.false;
  });
});

describe('disconnected', () => {
  it('invokes when element is removed', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div class="selector"></div>`);
    disconnected('.selector', callback);

    await nextFrame();
    expect(callback.called).to.be.false;

    root.remove();
    await nextFrame();
    expect(callback.calledOnceWith(root)).to.be.true;
  });

  it('invokes when the selector value is removed', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div class="selector"></div>`);
    disconnected('.selector', callback);

    root.setAttribute('class', '');
    await nextFrame();
    expect(callback.calledOnceWith(root)).to.be.true;
  });

  it('invokes when the selector itself is removed', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div class="selector"></div>`);
    disconnected('.selector', callback);

    root.removeAttribute('class');
    await nextFrame();
    expect(callback.calledOnceWith(root)).to.be.true;
  });

  it('does not invoke when stopped', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div class="selector"></div>`);
    const stop = disconnected('.selector', callback);

    stop();

    root.remove();
    await nextFrame();
    expect(callback.called).to.be.false;
  });

  it('does not invoke when an unrelated attribute is removed', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div data-toggle="tooltip" title="Title"></div>`);
    disconnected('[data-toggle="tooltip"]', callback);

    root.removeAttribute('title');
    await nextFrame();
    expect(callback.called).to.be.false;
  });
});
