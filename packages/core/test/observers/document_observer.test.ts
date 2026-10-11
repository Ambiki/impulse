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

  describe('registered while records are still queued', () => {
    it('delivers them to the other watchers before it scans', async () => {
      const root = await fixture(html`<div></div>`);
      const calls: string[] = [];
      const stopOther = watchSelector('.queued-other', { elementConnected: () => calls.push('other') });
      let stop = () => {};
      try {
        const element = document.createElement('div');
        element.className = 'queued-other queued-registered';
        root.append(element);
        stop = watchSelector('.queued-registered', { elementConnected: () => calls.push('registered') });

        expect(calls).to.deep.equal(['other', 'registered']);
      } finally {
        stop();
        stopOther();
      }
    });

    it('delivers the records their callbacks queue as well', async () => {
      const root = await fixture(html`<div></div>`);
      const item = document.createElement('b');
      item.className = 'queued-by-callback';
      const calls: string[] = [];
      const stopHost = watchSelector('.queued-host', { elementConnected: (host) => host.replaceChildren(item) });
      let stop = () => {};
      try {
        const host = document.createElement('div');
        host.className = 'queued-host';
        host.append(document.createElement('i'));
        root.append(host);
        stop = watchSelector('.queued-by-callback', {
          elementConnected: () => calls.push('connected'),
          elementDisconnected: () => calls.push('disconnected'),
        });
        await nextFrame();

        expect(calls).to.deep.equal(['connected']);
      } finally {
        stop();
        stopHost();
      }
    });

    it('leaves them queued behind the batch being processed when a callback registers it', async () => {
      const root = await fixture(html`<div><b class="overtaken"></b></div>`);
      const item = root.querySelector('b')!;
      const calls: string[] = [];
      const stop = watchSelector('.overtaken', {
        elementConnected: () => calls.push('connected'),
        elementDisconnected: () => calls.push('disconnected'),
      });
      let stopRegistered = () => {};
      // Puts `item` back while the record for its removal is still waiting in the batch.
      const stopTrigger = watchSelector('.overtaking', {
        elementConnected: () => {
          root.append(item);
          stopRegistered = watchSelector('.registered-by-callback', {});
        },
      });
      try {
        const trigger = document.createElement('i');
        trigger.className = 'overtaking';
        root.append(trigger);
        item.remove();
        await nextFrame();

        expect(calls).to.deep.equal(['connected', 'disconnected', 'connected']);
      } finally {
        stopRegistered();
        stopTrigger();
        stop();
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

describe('subtree enumeration', () => {
  it('connects an element whose anchoring ancestor is outside the added subtree', async () => {
    const root = await fixture(html`<div class="open"><section></section></div>`);
    const section = root.querySelector('section')!;
    const elementConnected = Sinon.spy();
    const stop = watchSelector('.open .item', { elementConnected });
    try {
      // The added subtree is already in the document when the record is delivered, so `.open` resolves from outside it.
      const item = document.createElement('b');
      item.className = 'item';
      const wrapper = document.createElement('div');
      wrapper.append(item);
      section.append(wrapper);
      await nextFrame();

      expect(elementConnected.calledOnceWith(item)).to.be.true;
    } finally {
      stop();
    }
  });

  it('disconnects an element inside a removed subtree that its selector can no longer match', async () => {
    const root = await fixture(html`<div class="open"><section><b class="item"></b></section></div>`);
    const section = root.querySelector('section')!;
    const item = root.querySelector('b')!;
    const elementDisconnected = Sinon.spy();
    const stop = watchSelector('.open .item', { elementDisconnected });
    try {
      // Detached, `.open .item` matches nothing inside the subtree; the subject `.item` still finds the element.
      section.remove();
      await nextFrame();

      expect(elementDisconnected.calledOnceWith(item)).to.be.true;
    } finally {
      stop();
    }
  });

  it('disconnects an element whose subject stopped matching in the same task as its removal', async () => {
    const root = await fixture(html`<div><section><b class="item"></b></section></div>`);
    const section = root.querySelector('section')!;
    const item = root.querySelector('b')!;
    const elementDisconnected = Sinon.spy();
    const stop = watchSelector('.item', { elementDisconnected });
    try {
      // The attribute record is delivered first and the element is already detached by then. The removal walk
      // enumerates by subject, which this change just made the element stop matching, so the disconnect happens on
      // the attribute record instead.
      item.classList.remove('item');
      section.remove();
      await nextFrame();

      expect(elementDisconnected.calledOnceWith(item)).to.be.true;
    } finally {
      stop();
    }
  });

  it('disconnects an element removed in the same task as an unrelated attribute change', async () => {
    const root = await fixture(html`<div><section><b class="item"></b></section></div>`);
    const section = root.querySelector('section')!;
    const item = root.querySelector('b')!;
    const elementDisconnected = Sinon.spy();
    const elementAttributeChanged = Sinon.spy();
    const stop = watchSelector('.item', { elementDisconnected, elementAttributeChanged });
    try {
      section.remove();
      item.classList.add('other');
      await nextFrame();

      expect(elementDisconnected.calledOnceWith(item)).to.be.true;
      // A detached element is gone, not changed, however the records happen to be ordered.
      expect(elementAttributeChanged.called).to.be.false;
    } finally {
      stop();
    }
  });

  it('walks every element when a registered selector has no queryable subject', async () => {
    const root = await fixture(html`<div class="open"></div>`);
    const elementConnected = Sinon.spy();
    const stop = watchSelector('.item', { elementConnected });
    const stopUniversal = watchSelector('.open *', {});
    try {
      const item = document.createElement('b');
      item.className = 'item';
      root.append(item);
      await nextFrame();
      expect(elementConnected.calledOnceWith(item)).to.be.true;

      const elementDisconnected = Sinon.spy();
      const stopDisconnect = watchSelector('.item', { elementDisconnected });
      item.remove();
      await nextFrame();
      expect(elementDisconnected.calledOnceWith(item)).to.be.true;
      stopDisconnect();
    } finally {
      stopUniversal();
      stop();
    }
  });
});

// The call removes the child and inserts the node in one step. Firefox reports only the container's record, with none
// for the node leaving its old parent.
describe('replaceChildren with a node from inside a child it removes', () => {
  it('disconnects the moved node and connects it again', async () => {
    const root = await fixture(html`<div><section><b class="lifted"></b></section></div>`);
    const item = root.querySelector('b')!;
    const calls: string[] = [];
    const stop = watchSelector('.lifted', {
      elementConnected: () => calls.push('connected'),
      elementDisconnected: () => calls.push('disconnected'),
    });
    try {
      root.replaceChildren(item);
      await nextFrame();

      expect(calls).to.deep.equal(['connected', 'disconnected', 'connected']);
    } finally {
      stop();
    }
  });

  it('disconnects a descendant of the moved node that its selector no longer matches', async () => {
    const root = await fixture(html`
      <div>
        <section class="lifted-open"><p><b class="lifted-inner"></b></p></section>
      </div>
    `);
    const moved = root.querySelector('p')!;
    const item = root.querySelector('b')!;
    const elementConnected = Sinon.spy();
    const elementDisconnected = Sinon.spy();
    const stop = watchSelector('.lifted-open .lifted-inner', { elementConnected, elementDisconnected });
    try {
      root.replaceChildren(moved);
      await nextFrame();

      expect(elementDisconnected.calledOnceWith(item)).to.be.true;
      expect(elementConnected.calledOnce).to.be.true;
    } finally {
      stop();
    }
  });

  it('connects a node once when the callback for its new parent put it there', async () => {
    const root = await fixture(html`<div></div>`);
    const item = document.createElement('b');
    item.className = 'rendered-by-callback';
    const calls: string[] = [];
    const stopHost = watchSelector('.rendering-host', { elementConnected: (host) => host.replaceChildren(item) });
    const stop = watchSelector('.rendered-by-callback', {
      elementConnected: () => calls.push('connected'),
      elementDisconnected: () => calls.push('disconnected'),
    });
    try {
      const host = document.createElement('div');
      host.className = 'rendering-host';
      host.append(document.createElement('i'));
      root.append(host);
      await nextFrame();

      expect(calls).to.deep.equal(['connected']);
    } finally {
      stop();
      stopHost();
    }
  });

  it('connects a node once when it was matched earlier in the same batch', async () => {
    const root = await fixture(html`<div></div>`);
    const calls: string[] = [];
    const stop = watchSelector('.rendered', {
      elementConnected: () => calls.push('connected'),
      elementDisconnected: () => calls.push('disconnected'),
    });
    try {
      // The record for `host` is delivered first, and by then `item` is already inside it. The record that put it
      // there has the same shape as a move out of a removed child, but `item` was never anywhere else.
      const host = document.createElement('div');
      host.append(document.createElement('i'));
      const item = document.createElement('b');
      item.className = 'rendered';
      root.append(host);
      host.replaceChildren(item);
      await nextFrame();

      expect(calls).to.deep.equal(['connected']);
    } finally {
      stop();
    }
  });

  it('disconnects the moved node for a watcher that matched it before another watcher did in the same batch', async () => {
    const root = await fixture(html`<div><section><b class="lifted-early"></b></section></div>`);
    const item = root.querySelector('b')!;
    const calls: string[] = [];
    const stop = watchSelector('.lifted-early', {
      elementConnected: () => calls.push('connected'),
      elementDisconnected: () => calls.push('disconnected'),
    });
    const stopLate = watchSelector('.lifted-late', {});
    try {
      await nextFrame();
      // The attribute record comes first and matches `item` for the second watcher where it is now.
      item.classList.add('lifted-late');
      root.replaceChildren(item);
      await nextFrame();

      expect(calls).to.deep.equal(['connected', 'disconnected', 'connected']);
    } finally {
      stopLate();
      stop();
    }
  });

  it('connects a node once for a watcher registered after the call and before its record is delivered', async () => {
    const root = await fixture(html`<div><i></i></div>`);
    const calls: string[] = [];
    // Keeps the observer running, so the call below is recorded.
    const stopOther = watchSelector('.keeps-observing', {});
    let stop = () => {};
    try {
      const item = document.createElement('b');
      item.className = 'registered-late';
      root.replaceChildren(item);
      stop = watchSelector('.registered-late', {
        elementConnected: () => calls.push('connected'),
        elementDisconnected: () => calls.push('disconnected'),
      });
      await nextFrame();

      expect(calls).to.deep.equal(['connected']);
    } finally {
      stop();
      stopOther();
    }
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
