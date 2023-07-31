import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import Sinon from 'sinon';
import { ImpulseElement, registerElement, target } from '../src';

describe('@target', () => {
  describe('initialize', () => {
    @registerElement('target-initialize-test')
    class TargetTest extends ImpulseElement {
      panelConnectedSpy = Sinon.spy();
      buttonConnectedSpy = Sinon.spy();
      sheetConnectedSpy = Sinon.spy();

      @target() panel: HTMLElement;
      @target() button: HTMLButtonElement;
      @target() sheet: HTMLElement;

      panelConnected(panel: HTMLElement) {
        this.panelConnectedSpy.call(this, panel, this.panel);
      }

      buttonConnected(button: HTMLButtonElement) {
        this.buttonConnectedSpy.call(this, button, this.button);
      }

      sheetConnected(sheet: HTMLElement) {
        this.sheetConnectedSpy.call(this, sheet, this.sheet);
      }
    }

    let el: TargetTest;
    beforeEach(async () => {
      el = await fixture(html`
        <target-initialize-test>
          <div id="panel1" data-target="target-initialize-test.panel"></div>
          <div id="panel2" data-target="target-initialize-test.panel"></div>
          <button type="button" id="button" data-target="target-initialize-test.button"></button>
        </target-initialize-test>
      `);
    });

    it('callbacks are invoked when the target connects to the DOM', () => {
      const panel = el.querySelector('#panel1');
      const button = el.querySelector('#button');

      expect(el.panelConnectedSpy.calledOnceWith(panel, panel)).to.be.true;
      expect(el.panelConnectedSpy.calledOn(el)).to.be.true;
      expect(el.buttonConnectedSpy.calledOnceWith(button, button)).to.be.true;
      expect(el.buttonConnectedSpy.calledOn(el)).to.be.true;
    });

    it('can reference the target', () => {
      expect(el).to.have.property('panel').exist.with.attribute('id', 'panel1');
    });

    it('calls the lifecycle function after appending the target element', async () => {
      const element = document.createElement('div');
      element.setAttribute('data-target', 'target-initialize-test.sheet');
      el.append(element);
      await waitUntil(() => el.sheetConnectedSpy.called);

      expect(el.sheetConnectedSpy.calledWith(element, element)).to.be.true;
      expect(el.sheetConnectedSpy.calledOn(el)).to.be.true;
    });
  });

  describe('terminates the target', () => {
    @registerElement('target-terminate-test')
    class TargetTest extends ImpulseElement {
      panelDisconnectedSpy = Sinon.spy();
      sheetDisconnectedSpy = Sinon.spy();
      buttonDisconnectedSpy = Sinon.spy();

      @target() panel: HTMLElement;
      @target() button: HTMLButtonElement;

      panelDisconnected(panel: HTMLElement) {
        this.panelDisconnectedSpy.call(this, panel, this.panel);
      }

      sheetDisconnected() {
        this.sheetDisconnectedSpy();
      }

      buttonConnected(button: HTMLButtonElement) {
        this.buttonDisconnectedSpy.call(this, button, this.button);
      }
    }

    let el: TargetTest;
    beforeEach(async () => {
      el = await fixture(html`
        <target-terminate-test>
          <div id="panel1" data-target="target-terminate-test.panel"></div>
          <div id="sheet" data-target="target-terminate-test.sheet"></div>
          <button type="button" id="button" data-target="target-terminate-test.button"></button>
        </target-terminate-test>
      `);
    });

    it('calls the target disconnected callback', async () => {
      const panel = el.querySelector('#panel1');
      const button = el.querySelector('#button');
      panel?.remove();
      button?.remove();

      await waitUntil(() => el.panelDisconnectedSpy.called);
      await waitUntil(() => el.buttonDisconnectedSpy.called);
      expect(el.panelDisconnectedSpy.calledOnceWith(panel, panel)).to.be.true;
      expect(el.panelDisconnectedSpy.calledOn(el)).to.be.true;
      expect(el.buttonDisconnectedSpy.calledOnceWith(button, button)).to.be.true;
      expect(el.buttonDisconnectedSpy.calledOn(el)).to.be.true;
    });

    it('does not call target disconnected callback for unregistered target', async () => {
      const sheet = el.querySelector('sheet');
      sheet?.remove();
      await nextFrame();

      expect(el.sheetDisconnectedSpy.called).to.be.false;
    });
  });

  it('terminates the target when the element is removed from the DOM', async () => {
    @registerElement('target-element-terminate-test')
    class TargetTest extends ImpulseElement {
      panelDisconnectedSpy = Sinon.spy();

      @target() panel: HTMLElement;

      panelDisconnected(panel: HTMLElement) {
        this.panelDisconnectedSpy.call(this, panel, this.panel);
      }
    }

    const el: TargetTest = await fixture(html`
      <target-element-terminate-test>
        <div id="panel1" data-target="target-element-terminate-test.panel"></div>
      </target-element-terminate-test>
    `);

    const panel = el.querySelector('#panel1');
    el.remove();

    expect(el.panelDisconnectedSpy.calledOnceWith(panel, panel)).to.be.true;
    expect(el.panelDisconnectedSpy.calledOn(el)).to.be.true;
  });

  it('can access the target when element is removed from the DOM', async () => {
    @registerElement('target-element-disconnect-test')
    class TargetTest extends ImpulseElement {
      disconnectedSpy = Sinon.spy();

      @target() panel: HTMLElement;

      disconnected() {
        this.disconnectedSpy.call(this, this.panel);
      }
    }

    const el: TargetTest = await fixture(html`
      <target-element-disconnect-test>
        <div id="panel1" data-target="target-element-disconnect-test.panel">
      </target-element-disconnect-test>
    `);

    const panel = el.querySelector('#panel1');
    el.remove();

    expect(el.disconnectedSpy.calledOnceWith(panel)).to.be.true;
    expect(el.disconnectedSpy.calledOn(el)).to.be.true;
  });
});
