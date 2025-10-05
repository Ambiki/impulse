import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import Sinon from 'sinon';
import { emit, on } from '../src';

describe('on', () => {
  it('sets up an event listener', async () => {
    const callback = Sinon.spy();
    const root = await fixture<HTMLButtonElement>(html`<button></button>`);
    on('click', 'button', callback);

    root.click();
    expect(callback.calledOnce).to.be.true;
    expect(callback.firstCall.args[0]).to.be.instanceOf(Event);
    expect(callback.firstCall.args[1]).to.eq(root);
  });

  it('cleans up the event listener manually', async () => {
    const callback = Sinon.spy();
    const root = await fixture<HTMLButtonElement>(html`<button id="selector"></button>`);
    const stop = on('click', '#selector', callback);

    root.click();
    expect(callback.calledOnce).to.be.true;

    callback.resetHistory();
    stop();
    expect(callback.called).to.be.false;
  });

  it('cleans up the event listener when attribute itself is removed', async () => {
    const callback = Sinon.spy();
    const root = await fixture<HTMLButtonElement>(html`<button id="selector"></button>`);
    on('click', '#selector', callback);

    root.click();
    expect(callback.calledOnce).to.be.true;

    callback.resetHistory();
    root.removeAttribute('id');
    await waitUntil(() => !root.hasAttribute('id'));
    root.click();
    expect(callback.called).to.be.false;
  });

  it('supports event listener options', async () => {
    const callback = Sinon.spy();
    const root = await fixture<HTMLButtonElement>(html`<button id="selector"></button>`);
    on('click', '#selector', callback, { once: true });

    root.click();
    root.click();
    expect(callback.callCount).to.eq(1);
  });
});

describe('emit', () => {
  it('emits an event', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div></div>`);
    document.addEventListener('emit-test:change', callback);

    emit(root, 'emit-test:change');
    expect(callback.calledOnce).to.be.true;
    expect(callback.getCall(0).args[0].detail).to.deep.equal({});
  });

  it('sets the detail', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div></div>`);
    document.addEventListener('emit-test:change', callback);

    emit<{ name: string }>(root, 'emit-test:change', { detail: { name: 'John' } });
    expect(callback.calledOnce).to.be.true;
    expect(callback.getCall(0).args[0].detail).to.deep.equal({ name: 'John' });
  });
});
