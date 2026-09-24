import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import Sinon from 'sinon';
import { lazyImport } from '../src';
import { captureReportedErrors } from './support/capture_reported_errors';
import { simulateParsing } from './support/parsing';

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

  it('calls the callback once when a matching element is already in the DOM', async () => {
    await fixture(html`<div class="lazy-already"></div>`);
    const callback = Sinon.spy();
    lazyImport('.lazy-already', callback);

    await nextFrame();
    expect(callback.calledOnce).to.be.true;
  });

  it('calls the callback once for several existing matches and not again for later ones', async () => {
    const root = await fixture(html`
      <div>
        <div class="lazy-several"></div>
        <div class="lazy-several"></div>
      </div>
    `);
    const callback = Sinon.spy();
    lazyImport('.lazy-several', callback);

    await nextFrame();
    expect(callback.calledOnce).to.be.true;

    const late = document.createElement('div');
    late.classList.add('lazy-several');
    root.append(late);
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

  it('reports a callback that throws and still calls the others for the selector', async () => {
    const { reported, release } = captureReportedErrors('lazy callback failed');
    const callback = Sinon.spy();
    try {
      lazyImport('.lazy-throwing', () => {
        throw new Error('lazy callback failed');
      });
      lazyImport('.lazy-throwing', callback);
      await fixture(html`<div class="lazy-throwing"></div>`);

      await nextFrame();
      expect(reported).to.have.length(1);
      expect(callback.calledOnce).to.be.true;
    } finally {
      release();
    }
  });
});

describe('lazy import before the document is Parsed', () => {
  let finishParsing: () => void;

  beforeEach(() => {
    finishParsing = simulateParsing();
  });

  afterEach(() => {
    finishParsing();
  });

  it('waits until the document is Parsed to call the callback', async () => {
    const callback = Sinon.spy();
    lazyImport('.lazy-parsing-present', callback);
    await fixture(html`<div class="lazy-parsing-present"></div>`);

    await nextFrame();
    expect(callback.called).to.be.false;

    finishParsing();
    await nextFrame();
    expect(callback.calledOnce).to.be.true;
  });

  it('never calls the callback for an element inserted and removed while parsing', async () => {
    const callback = Sinon.spy();
    lazyImport('.lazy-parsing-transient', callback);
    const root = await fixture(html`<div></div>`);

    const element = document.createElement('div');
    element.className = 'lazy-parsing-transient';
    root.append(element);
    await nextFrame();
    element.remove();
    await nextFrame();

    finishParsing();
    await nextFrame();
    expect(callback.called).to.be.false;
  });
});
