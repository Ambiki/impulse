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

describe('attribute changes', () => {
  it('does not deliver attributes that no registered selector depends on', async () => {
    const element = await fixture<HTMLElement>(html`<div data-filtered="a"></div>`);
    const elementAttributeChanged = Sinon.spy();
    const stop = watchSelector('[data-filtered]', { elementAttributeChanged });
    try {
      element.setAttribute('title', 'changed');
      element.style.color = 'red';
      element.classList.add('changed');
      await nextFrame();
      expect(elementAttributeChanged.called).to.be.false;

      element.setAttribute('data-filtered', 'b');
      await nextFrame();
      expect(elementAttributeChanged.calledOnceWith(element, 'data-filtered')).to.be.true;
    } finally {
      stop();
    }
  });

  it('re-checks an element on any attribute change while a selector that is not self-contained is registered', async () => {
    const root = await fixture(html`<div><span class="fallback-item"></span></div>`);
    const item = root.querySelector('span')!;
    const elementConnected = Sinon.spy();
    const stop = watchSelector('.fallback-open .fallback-item', { elementConnected });
    try {
      // An ancestor's change does not re-check its descendants...
      root.classList.add('fallback-open');
      await nextFrame();
      expect(elementConnected.called).to.be.false;

      // ...but any later attribute change on the element itself does.
      item.setAttribute('title', 'changed');
      await nextFrame();
      expect(elementConnected.calledOnceWith(item)).to.be.true;
    } finally {
      stop();
    }
  });

  it('stops delivering unneeded attributes once the selector that needed them is stopped', async () => {
    const element = await fixture(html`<div data-filtered="a"></div>`);
    const elementAttributeChanged = Sinon.spy();
    const stop = watchSelector('[data-filtered]', { elementAttributeChanged });
    const stopOther = watchSelector('.open .never-matches', {});
    try {
      element.setAttribute('title', 'first');
      await nextFrame();
      expect(elementAttributeChanged.calledOnceWith(element, 'title')).to.be.true;

      stopOther();
      element.setAttribute('title', 'second');
      await nextFrame();
      elementAttributeChanged.resetHistory();
      element.setAttribute('title', 'third');
      await nextFrame();
      expect(elementAttributeChanged.called).to.be.false;
    } finally {
      stopOther();
      stop();
    }
  });

  it('matches attribute names case-insensitively on HTML elements and case-sensitively on SVG elements', async () => {
    const root = await fixture(html`<div><span></span><svg></svg></div>`);
    const span = root.querySelector('span')!;
    const svg = root.querySelector('svg')!;
    const elementConnected = Sinon.spy();
    const stopHtml = watchSelector('[data-Case-Watch]', { elementConnected });
    const stopSvg = watchSelector('[viewBox]', { elementConnected });
    try {
      span.setAttribute('data-case-watch', '');
      svg.setAttribute('viewBox', '0 0 1 1');
      await nextFrame();
      expect(elementConnected.calledWith(span)).to.be.true;
      expect(elementConnected.calledWith(svg)).to.be.true;
    } finally {
      stopSvg();
      stopHtml();
    }
  });

  it('ignores attribute changes under a root element that replaced the observed one', async () => {
    const elementConnected = Sinon.spy();
    const stop = watchSelector('[data-new-root]', { elementConnected });
    const originalRoot = document.documentElement;
    const replacementRoot = document.createElement('html');
    const element = document.createElement('div');
    replacementRoot.append(element);
    try {
      document.replaceChild(replacementRoot, originalRoot);
      element.setAttribute('data-new-root', '');
      await nextFrame();
    } finally {
      document.replaceChild(originalRoot, replacementRoot);
      stop();
    }

    expect(elementConnected.called).to.be.false;
  });

  // A subtree removed in this task is still observed until the records are delivered, so an element removed from it
  // afterwards is disconnected. Changing which attributes are observed must not end that.
  describe('removals inside a detached subtree', () => {
    it('still disconnects the element when a watcher is registered in between', async () => {
      const root = await fixture(html`<div><section><p class="detached-leaf"></p></section></div>`);
      const section = root.querySelector('section')!;
      const leaf = root.querySelector('p')!;
      const elementDisconnected = Sinon.spy();
      const stopLeaf = watchSelector('.detached-leaf', { elementDisconnected });
      let stopOther = () => {};
      try {
        section.remove();
        stopOther = watchSelector('[data-registered-in-between]', {});
        leaf.remove();
        await nextFrame();

        expect(elementDisconnected.calledOnceWith(leaf)).to.be.true;
      } finally {
        stopOther();
        stopLeaf();
      }
    });

    it('still disconnects the element when a watcher is stopped in between', async () => {
      const root = await fixture(html`<div><section><p class="detached-leaf"></p></section></div>`);
      const section = root.querySelector('section')!;
      const leaf = root.querySelector('p')!;
      const elementDisconnected = Sinon.spy();
      const stopLeaf = watchSelector('.detached-leaf', { elementDisconnected });
      const stopOther = watchSelector('.open .never-matches', {});
      try {
        section.remove();
        stopOther();
        leaf.remove();
        await nextFrame();

        expect(elementDisconnected.calledOnceWith(leaf)).to.be.true;
      } finally {
        stopOther();
        stopLeaf();
      }
    });

    it('keeps callback order for a subtree re-inserted after a watcher is stopped in between', async () => {
      const root = await fixture(html`<div><section class="reinserted"><p></p></section></div>`);
      const section = root.querySelector('section')!;
      const paragraph = root.querySelector('p')!;
      const calls: string[] = [];
      const stopReinserted = watchSelector('.reinserted', {
        elementConnected: (element) => calls.push(`connected ${element.localName}`),
        elementDisconnected: (element) => calls.push(`disconnected ${element.localName}`),
      });
      const stopOther = watchSelector('.open .never-matches', {});
      try {
        calls.length = 0;
        section.remove();
        stopOther();
        paragraph.classList.add('reinserted');
        root.append(section);
        await nextFrame();

        // The class change on the detached paragraph is recorded between the removal and the insertion, so the
        // paragraph connects before the insertion walk reaches the section.
        expect(calls).to.deep.equal(['disconnected section', 'connected p', 'connected section']);
      } finally {
        stopOther();
        stopReinserted();
      }
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
