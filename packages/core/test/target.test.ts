import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import Sinon from 'sinon';
import { ImpulseElement, registerElement, target } from '../src';
import { captureReportedErrors } from './support/capture_reported_errors';

describe('@target', () => {
  @registerElement('target-test')
  class TargetTest extends ImpulseElement {
    connectedSpy = Sinon.spy();
    disconnectedSpy = Sinon.spy();
    panelConnectedSpy = Sinon.spy();
    buttonConnectedSpy = Sinon.spy();
    sheetConnectedSpy = Sinon.spy();
    panelDisconnectedSpy = Sinon.spy();
    buttonDisconnectedSpy = Sinon.spy();
    sheetDisconnectedSpy = Sinon.spy();

    @target() panel: HTMLElement;
    @target() sheet: HTMLElement;
    @target() button: HTMLButtonElement;

    connected() {
      this.connectedSpy();
    }

    disconnected() {
      this.disconnectedSpy();
    }

    panelConnected(panel: HTMLElement) {
      this.panelConnectedSpy(panel, this.panel);
    }

    buttonConnected(button: HTMLButtonElement) {
      this.buttonConnectedSpy(button, this.button);
    }

    sheetConnected(sheet: HTMLElement) {
      this.sheetConnectedSpy(sheet, this.sheet);
    }

    panelDisconnected(panel: HTMLElement) {
      this.panelDisconnectedSpy(panel, this.panel);
    }

    buttonDisconnected(button: HTMLButtonElement) {
      this.buttonDisconnectedSpy(button, this.button);
    }

    sheetDisconnected(sheet: HTMLElement) {
      this.sheetDisconnectedSpy(sheet, this.sheet);
    }
  }

  let el: TargetTest;
  beforeEach(async () => {
    el = await fixture(html`
      <target-test>
        <div id="panel" data-target="target-test.panel"></div>
        <div id="just-div"></div>
        <button type="button" id="button" data-target="target-test.button"></button>
        <target-test>
          <div id="panel2" data-target="target-test.panel"></div>
          <div id="sheet" data-target="target-test.sheet"></div>
        </target-test>
      </target-test>
    `);
  });

  it('should be able to reference the target', () => {
    expect(el.panel).to.eq(el.querySelector('#panel'));
    expect(el.button).to.eq(el.querySelector('#button'));
  });

  it('should ignore child element target', () => {
    expect(el.sheet).to.eq(null);

    const el2 = el.querySelector<TargetTest>('target-test')!;
    expect(el2.sheet).to.eq(el2?.querySelector('#sheet'));
  });

  it('should call the lifecycle callback function when target is connected to the DOM', () => {
    const panel = el.querySelector('#panel');
    const button = el.querySelector('#button');

    expect(el.panelConnectedSpy.calledOnceWith(panel, panel)).to.be.true;
    expect(el.buttonConnectedSpy.calledOnceWith(button, button)).to.be.true;
    expect(el.sheetConnectedSpy.notCalled).to.be.true;

    const el2 = el.querySelector<TargetTest>('target-test')!;
    const sheet = el2.querySelector('#sheet');
    expect(el2.sheetConnectedSpy.calledOnceWith(sheet, sheet)).to.be.true;
  });

  it('should call the lifecycle callback function when a target is inserted to the DOM', async () => {
    const sheet = document.createElement('div');
    sheet.setAttribute('data-target', `${el.identifier}.sheet`);
    el.append(sheet);

    await waitUntil(() => el.sheetConnectedSpy.called);
    expect(el.sheetConnectedSpy.calledOnceWith(sheet, sheet)).to.be.true;
  });

  it('should call the child lifecycle callback function when a target is inserted to the DOM', async () => {
    const el2 = el.querySelector<TargetTest>('target-test')!;
    const button = document.createElement('div');
    button.setAttribute('data-target', `${el2.identifier}.button`);
    el2.append(button);

    await waitUntil(() => el2.buttonConnectedSpy.called);
    expect(el2.buttonConnectedSpy.calledOnceWith(button, button)).to.be.true;
    expect(el.buttonConnectedSpy.calledOnce).to.be.true; // when first connected
  });

  it('should call the [target]Connected callback if target identifier is added', async () => {
    const div = document.getElementById('just-div');
    div?.setAttribute('data-target', `${el.identifier}.sheet`);
    await waitUntil(() => el.sheetConnectedSpy.called);
    expect(el.sheetConnectedSpy.calledOnce).to.be.true;
  });

  it('should call the [target]Disconnected callback if target identifier is removed', async () => {
    const el2 = el.querySelector<TargetTest>('target-test')!;
    const div = document.getElementById('panel2');
    div?.setAttribute('data-target', '');
    await waitUntil(() => el2.panelDisconnectedSpy.called);
    expect(el2.panelDisconnectedSpy.calledOnce).to.be.true;
  });

  it('should call the [target]Disconnected callback if data-target is removed', async () => {
    const el2 = el.querySelector<TargetTest>('target-test')!;
    const div = document.getElementById('panel2');
    div?.removeAttribute('data-target');
    await nextFrame();
    expect(el2.panelDisconnectedSpy.calledOnce).to.be.true;
  });

  it('should register duplicate data-target tokens once', async () => {
    const div = document.getElementById('just-div')!;
    div.setAttribute('data-target', `${el.identifier}.sheet ${el.identifier}.sheet`);
    await waitUntil(() => el.sheetConnectedSpy.called);
    expect(el.sheetConnectedSpy.calledOnce).to.be.true;
    expect(el.sheet).to.eq(div);
  });

  it('should keep the target when one of two duplicate data-target tokens is removed', async () => {
    const div = document.getElementById('just-div')!;
    div.setAttribute('data-target', `${el.identifier}.sheet ${el.identifier}.sheet`);
    await waitUntil(() => el.sheetConnectedSpy.called);

    div.setAttribute('data-target', `${el.identifier}.sheet`);
    await nextFrame();
    expect(el.sheet).to.eq(div);
    expect(el.sheetDisconnectedSpy.notCalled).to.be.true;

    div.removeAttribute('data-target');
    await nextFrame();
    expect(el.sheet).to.eq(null);
    expect(el.sheetDisconnectedSpy.calledOnce).to.be.true;
  });

  it('should keep a target declared with duplicate tokens in the initial HTML when one token is removed', async () => {
    @registerElement('duplicate-target-test')
    class DuplicateTargetTest extends ImpulseElement {
      @target() sheet: HTMLElement;
    }

    const root = await fixture<DuplicateTargetTest>(html`
      <duplicate-target-test>
        <div data-target="duplicate-target-test.sheet duplicate-target-test.sheet"></div>
      </duplicate-target-test>
    `);
    const div = root.querySelector('div')!;
    expect(root.sheet).to.eq(div);

    div.setAttribute('data-target', 'duplicate-target-test.sheet');
    await nextFrame();
    expect(root.sheet).to.eq(div);
  });

  it('should call the connected callback after [target]Connected callback', () => {
    expect(el.connectedSpy.calledAfter(el.panelConnectedSpy)).to.be.true;
    expect(el.connectedSpy.calledAfter(el.buttonConnectedSpy)).to.be.true;
  });

  it('should not call the [target]Connected callback if the identifier do not match', () => {
    const div = document.createElement('div');
    div.setAttribute('data-target', 'unknown-identifier.sheet');
    el.append(div);

    expect(el.sheetConnectedSpy.notCalled).to.be.true;
  });

  it('should call the lifecycle callback function when target is disconnected from the DOM', () => {
    const panel = el.querySelector('#panel');
    const button = el.querySelector('#button');

    el.remove();

    expect(el.panelDisconnectedSpy.calledOnceWith(panel, panel)).to.be.true;
    expect(el.buttonDisconnectedSpy.calledOnceWith(button, button)).to.be.true;
    expect(el.sheetDisconnectedSpy.notCalled).to.be.true;

    const el2 = el.querySelector<TargetTest>('target-test')!;
    const sheet = el2.querySelector('#sheet');
    expect(el2.sheetDisconnectedSpy.calledOnceWith(sheet, sheet)).to.be.true;
  });

  it('should call the lifecycle callback function when a target is removed from the DOM', async () => {
    const panel = el.querySelector('#panel')!;
    panel.remove();

    await waitUntil(() => el.panelDisconnectedSpy.called);
    expect(el.panelDisconnectedSpy.calledOnceWith(panel, panel)).to.be.true;
  });

  it('should call the lifecycle callback function when a target is removed from the DOM for an inserted target', async () => {
    const sheet = document.createElement('div');
    sheet.setAttribute('data-target', `${el.identifier}.sheet`);
    el.append(sheet);

    await waitUntil(() => el.sheetConnectedSpy.called);
    expect(el.sheetConnectedSpy.called).to.be.true;

    sheet.remove();

    await waitUntil(() => el.sheetDisconnectedSpy.called);
    expect(el.sheetDisconnectedSpy.calledWith(sheet, sheet)).to.be.true;
  });

  it('should call the child lifecycle callback function when a target is removed from the DOM', async () => {
    const el2 = el.querySelector<TargetTest>('target-test')!;
    const panel = el.querySelector('#panel2')!;
    panel.remove();

    await waitUntil(() => el2?.panelDisconnectedSpy.called);
    expect(el2.panelDisconnectedSpy.calledOnceWith(panel, panel)).to.be.true;
    expect(el.panelDisconnectedSpy.notCalled).to.be.true;
  });

  it('should call the disconnected callback before [target]Disconnected callback', () => {
    el.remove();
    expect(el.panelDisconnectedSpy.calledAfter(el.disconnectedSpy)).to.be.true;
    expect(el.buttonDisconnectedSpy.calledAfter(el.disconnectedSpy)).to.be.true;
  });

  it('should not call the [target]Disconnected callback if the identifier do not match', () => {
    const div = document.createElement('div');
    div.setAttribute('data-target', 'unknown-identifier.sheet');
    el.append(div);
    div.remove();

    expect(el.sheetDisconnectedSpy.notCalled).to.be.true;
  });

  describe('when a second element carries the same target', () => {
    let old: Element;
    let errors: ReturnType<typeof captureReportedErrors>;
    beforeEach(() => {
      old = el.querySelector('#panel')!;
      errors = captureReportedErrors('Multiple "panel" targets');
    });
    afterEach(() => errors.release());

    function createPanel(descriptors = `${el.identifier}.panel`) {
      const panel = document.createElement('div');
      panel.setAttribute('data-target', descriptors);
      return panel;
    }

    // Appends a second panel and lets it be delivered, which leaves it waiting behind `old`.
    async function addWaitingPanel(descriptors?: string) {
      const panel = createPanel(descriptors);
      el.append(panel);
      await nextFrame();
      return panel;
    }

    it('should adopt a replacement inserted before the old target is removed', async () => {
      const fresh = await addWaitingPanel();
      expect(el.panel).to.eq(old);

      old.remove();
      await nextFrame();

      expect(el.panel).to.eq(fresh);
      expect(el.panelDisconnectedSpy.calledOnceWith(old, old)).to.be.true;
      expect(el.panelConnectedSpy.calledTwice).to.be.true;
      expect(el.panelConnectedSpy.secondCall.calledWith(fresh, fresh)).to.be.true;
      expect(el.panelConnectedSpy.secondCall.calledAfter(el.panelDisconnectedSpy.firstCall)).to.be.true;
    });

    it('should report a second element that is still there once the changes that added it are processed', async () => {
      await addWaitingPanel();

      expect(errors.reported.length).to.eq(1);
      expect(el.panel).to.eq(old);
    });

    it('should report nothing when the replacement is inserted and the old target removed in one task', async () => {
      const fresh = createPanel();
      old.after(fresh);
      old.remove();
      await nextFrame();

      expect(el.panel).to.eq(fresh);
      expect(errors.reported).to.be.empty;
    });

    it('should report nothing when a replacement listing the target twice is swapped in within one task', async () => {
      const fresh = createPanel(`${el.identifier}.panel ${el.identifier}.panel`);
      old.after(fresh);
      old.remove();
      await nextFrame();

      expect(el.panel).to.eq(fresh);
      expect(errors.reported).to.be.empty;
    });

    it('should forget a waiting element that is removed before the target', async () => {
      const extra = await addWaitingPanel();

      extra.remove();
      await nextFrame();
      expect(el.panel).to.eq(old);
      expect(el.panelDisconnectedSpy.notCalled).to.be.true;

      old.remove();
      await nextFrame();
      expect(el.panel).to.eq(null);
      expect(el.panelConnectedSpy.calledOnce).to.be.true;
    });

    it('should keep the target when it is moved while another element waits', async () => {
      await addWaitingPanel();

      // Now the last of the two in document order. Its removal is delivered before its insertion.
      el.append(old);
      await nextFrame();

      expect(el.panel).to.eq(old);
      expect(el.panelDisconnectedSpy.calledOnceWith(old, old)).to.be.true;
      expect(el.panelConnectedSpy.calledTwice).to.be.true;
      expect(el.panelConnectedSpy.secondCall.calledWith(old, old)).to.be.true;
    });

    it('should not adopt a waiting element removed in the same task as the target', async () => {
      const extra = await addWaitingPanel();

      // Two records in one batch, the target's first: the waiting element is already detached when the target's
      // removal is processed, and its own removal has not been delivered yet.
      old.remove();
      extra.remove();
      await nextFrame();

      expect(el.panel).to.eq(null);
      expect(el.panelConnectedSpy.calledOnce).to.be.true;
      expect(el.panelDisconnectedSpy.calledOnceWith(old, old)).to.be.true;
    });

    it('should not adopt a waiting element that drops the target in the same task as the old one leaves', async () => {
      const extra = await addWaitingPanel();

      // The waiting element is still in place when the target's removal is processed; only its attribute has moved on.
      old.remove();
      extra.removeAttribute('data-target');
      await nextFrame();

      expect(el.panel).to.eq(null);
      expect(el.panelConnectedSpy.calledOnce).to.be.true;
      expect(el.panelDisconnectedSpy.calledOnceWith(old, old)).to.be.true;
    });

    it('should keep an adopted element that drops a second spelling of the target in the same task', async () => {
      // Any segment past the key is ignored, so both tokens name `panel`.
      const fresh = await addWaitingPanel(`${el.identifier}.panel ${el.identifier}.panel.alias`);

      // Only the first token is still listed when the old target's removal is processed.
      old.remove();
      fresh.setAttribute('data-target', `${el.identifier}.panel`);
      await nextFrame();

      expect(el.panel).to.eq(fresh);
      expect(el.panelDisconnectedSpy.calledOnceWith(old, old)).to.be.true;
    });

    it('should adopt a waiting element whose target a callback restores while the batch is processed', async () => {
      const extra = createPanel();
      const sheet = document.createElement('div');
      sheet.setAttribute('data-target', `${el.identifier}.sheet`);
      el.append(extra, sheet);
      await nextFrame();
      el.sheetDisconnectedSpy = Sinon.stub().callsFake(() => {
        extra.setAttribute('data-target', `${el.identifier}.panel`);
      });

      // The waiting element no longer lists the target when the old one's removal is processed, and has it back before
      // its own attribute record is: the attribute ends where it began, so no record reports a change.
      old.remove();
      sheet.remove();
      extra.setAttribute('data-target', `${el.identifier}.other`);
      await nextFrame();

      expect(el.panel).to.eq(extra);
      expect(el.panelConnectedSpy.calledTwice).to.be.true;
      expect(el.panelConnectedSpy.secondCall.calledWith(extra, extra)).to.be.true;
    });

    it('should not adopt a waiting element while the owner is disconnecting', async () => {
      await addWaitingPanel();

      el.remove();

      expect(el.panelConnectedSpy.calledOnce).to.be.true;
      expect(el.panelDisconnectedSpy.calledOnceWith(old, old)).to.be.true;
    });

    it('should adopt the first waiting element in document order', async () => {
      await addWaitingPanel();
      const earlier = createPanel();
      el.prepend(earlier);
      await nextFrame();

      old.remove();
      await nextFrame();

      expect(el.panel).to.eq(earlier);
      expect(el.panelConnectedSpy.calledTwice).to.be.true;
    });

    it('should adopt an element that lists the target twice as one target', async () => {
      const fresh = await addWaitingPanel(`${el.identifier}.panel ${el.identifier}.panel`);

      old.remove();
      await nextFrame();
      expect(el.panel).to.eq(fresh);

      fresh.removeAttribute('data-target');
      await nextFrame();

      expect(el.panel).to.eq(null);
      expect(el.panelConnectedSpy.calledTwice).to.be.true;
      expect(el.panelDisconnectedSpy.calledTwice).to.be.true;
      expect(el.panelDisconnectedSpy.secondCall.calledWith(fresh, fresh)).to.be.true;
    });

    it('should report both errors when the callbacks on either side of an adoption throw', async () => {
      const fresh = await addWaitingPanel();

      el.panelDisconnectedSpy = Sinon.stub().throws(new Error('panel disconnected failed'));
      el.panelConnectedSpy = Sinon.stub().throws(new Error('panel connected failed'));
      const failures = captureReportedErrors('failed');
      try {
        old.remove();
        await nextFrame();

        expect(failures.reported.map((error) => error.message)).to.have.members([
          'panel disconnected failed',
          'panel connected failed',
        ]);
        expect(el.panel).to.eq(fresh);
      } finally {
        // The fixture is torn down after the test, which runs `[target]Disconnected` once more.
        el.panelDisconnectedSpy = Sinon.spy();
        el.panelConnectedSpy = Sinon.spy();
        failures.release();
      }
    });
  });
});
