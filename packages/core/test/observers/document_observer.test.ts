import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import Sinon from 'sinon';
import { watchSelector } from '../../src/observers/document_observer';

describe('watchSelector', () => {
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
