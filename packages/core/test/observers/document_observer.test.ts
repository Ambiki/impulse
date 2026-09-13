import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import Sinon from 'sinon';
import { flushMutations, watchSelector } from '../../src/observers/document_observer';
import { captureReportedErrors } from '../support/capture_reported_errors';

describe('watchSelector', () => {
  describe('throwing callbacks', () => {
    it('reports an error thrown during the initial scan, keeps scanning, and still returns the cleanup', async () => {
      const root = await fixture(html`
        <div>
          <div class="scan-throws" id="first"></div>
          <div class="scan-throws" id="second"></div>
        </div>
      `);
      const elementConnected = Sinon.spy((element: Element) => {
        if (element.id === 'first') throw new Error('scan failed');
      });
      const errors = captureReportedErrors('scan failed');
      let stop = () => {};
      try {
        stop = watchSelector('.scan-throws', { elementConnected });
        expect(errors.reported.length).to.eq(1);
        expect(elementConnected.calledTwice).to.be.true;

        stop();
        const late = document.createElement('div');
        late.classList.add('scan-throws');
        root.append(late);
        await nextFrame();
        expect(elementConnected.calledTwice).to.be.true;
      } finally {
        stop();
        errors.release();
      }
    });
  });

  describe('detached elements', () => {
    it('does not fire elementConnected when an attribute change makes a detached element match', async () => {
      const elementConnected = Sinon.spy();
      const stop = watchSelector('.detached-match', { elementConnected });
      const element = await fixture(html`<div></div>`);

      // Removing and mutating in the same task: the transient registered observer still delivers the attribute record.
      element.remove();
      element.classList.add('detached-match');
      await nextFrame();
      expect(elementConnected.called).to.be.false;

      // Positive control: the watcher is live and the element matches once it is back in the tree.
      document.body.append(element);
      await nextFrame();
      element.remove();
      stop();

      expect(elementConnected.calledOnceWith(element)).to.be.true;
    });

    it('fires elementDisconnected once for a tracked element mutated and then removed in the same task', async () => {
      const elementDisconnected = Sinon.spy();
      const elementAttributeChanged = Sinon.spy();
      const stop = watchSelector('.tracked-then-removed', { elementDisconnected, elementAttributeChanged });
      const element = await fixture(html`<div class="tracked-then-removed"></div>`);

      // The attribute record is delivered first, but by then the element is already out of the tree. Callbacks never
      // observe an element that is no longer in the document, so only the disconnect fires.
      element.setAttribute('title', 'changed');
      element.remove();
      await nextFrame();
      stop();

      expect(elementAttributeChanged.called).to.be.false;
      expect(elementDisconnected.calledOnceWith(element)).to.be.true;
    });
  });
});

describe('flushMutations', () => {
  it('delivers pending mutation records synchronously', async () => {
    const root = await fixture(html`<div></div>`);
    const elementConnected = Sinon.spy();
    const stop = watchSelector('.flushed', { elementConnected });
    try {
      const element = document.createElement('div');
      element.classList.add('flushed');
      root.append(element);
      expect(elementConnected.called).to.be.false;

      flushMutations();
      expect(elementConnected.calledOnceWith(element)).to.be.true;

      // The observer must not deliver the same record again.
      await nextFrame();
      expect(elementConnected.calledOnce).to.be.true;
    } finally {
      stop();
    }
  });

  it('does nothing when no watcher is registered', () => {
    expect(() => flushMutations()).not.to.throw();
  });
});
