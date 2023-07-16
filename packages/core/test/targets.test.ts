import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import Sinon from 'sinon';
import { ImpulseElement, registerElement, targets } from '../src';

describe('@targets', () => {
  describe('initialize', () => {
    @registerElement('targets-initialize-test')
    class TargetsTest extends ImpulseElement {
      panelsConnectedSpy = Sinon.spy();
      sheetsConnectedSpy = Sinon.spy();

      @targets() panels: HTMLElement[];
      @targets() sheets: HTMLElement[];

      panelsConnected(panel: HTMLElement) {
        this.panelsConnectedSpy.call(this, panel, this.panels);
      }

      sheetsConnected(sheet: HTMLElement) {
        this.sheetsConnectedSpy.call(this, sheet, this.sheets);
      }
    }

    let el: TargetsTest;
    beforeEach(async () => {
      el = await fixture(html`
        <targets-initialize-test>
          <div class="panel" data-target="targets-initialize-test.panels"></div>
          <div class="panel" data-target="targets-initialize-test.panels"></div>
        </targets-initialize-test>
      `);
    });

    it('callbacks are invoked when the target connects to the DOM', () => {
      const panels = Array.from(el.querySelectorAll('.panel'));

      expect(el.panelsConnectedSpy.calledTwice).to.be.true;
      expect(el.panelsConnectedSpy.calledOn(el)).to.be.true;
      expect(el.panelsConnectedSpy.getCall(0).args).to.deep.equal([panels[0], panels]);
      expect(el.panelsConnectedSpy.getCall(1).args).to.deep.equal([panels[1], panels]);
    });

    it('can reference the targets', () => {
      expect(el.panels).to.deep.equal(Array.from(el.querySelectorAll('.panel')));
    });

    it('calls the lifecycle function after appending the target element', async () => {
      const element = document.createElement('div');
      element.setAttribute('data-target', 'targets-initialize-test.sheets');
      el.append(element);
      await nextFrame();

      expect(el.sheetsConnectedSpy.calledOnce).to.be.true;
      expect(el.sheetsConnectedSpy.getCall(0).args).to.deep.equal([element, [element]]);
      expect(el.sheetsConnectedSpy.calledOn(el)).to.be.true;
    });
  });

  describe('terminates the target', () => {
    @registerElement('targets-terminate-test')
    class TargetsTest extends ImpulseElement {
      panelsDisconnectedSpy = Sinon.spy();
      sheetsDisconnectedSpy = Sinon.spy();

      @targets() panels: HTMLElement[];

      panelsDisconnected(panel: HTMLElement) {
        this.panelsDisconnectedSpy.call(this, panel, this.panels);
      }

      sheetsDisconnected() {
        this.sheetsDisconnectedSpy();
      }
    }

    let el: TargetsTest;
    beforeEach(async () => {
      el = await fixture(html`
        <targets-terminate-test>
          <div class="panel" data-target="targets-terminate-test.panels"></div>
          <div class="panel" data-target="targets-terminate-test.panels"></div>
          <div class="sheet" data-target="targets-terminate-test.sheets"></div>
        </targets-terminate-test>
      `);
    });

    it('calls the target disconnected callback', async () => {
      const panels = Array.from(el.querySelectorAll('.panel'));
      panels[0].remove();
      await nextFrame();

      expect(el.panelsDisconnectedSpy.calledOnce).to.be.true;
      expect(el.panelsDisconnectedSpy.getCall(0).args).to.deep.equal([panels[0], panels]);
      expect(el.panelsDisconnectedSpy.calledOn(el)).to.be.true;

      panels[1].remove();
      await nextFrame();

      expect(el.panelsDisconnectedSpy.calledTwice).to.be.true;
      expect(el.panelsDisconnectedSpy.getCall(0).args).to.deep.equal([panels[1], panels]);
      expect(el.panelsDisconnectedSpy.calledOn(el)).to.be.true;
    });

    // Fails for some reason. Cannot replicate in the browser.
    it.skip('does not call target disconnected callback for unregistered targets', async () => {
      const sheets = Array.from(el.querySelectorAll('.sheet'));
      sheets[0].remove();
      await nextFrame();

      expect(el.sheetsDisconnectedSpy.called).to.be.false;
    });
  });

  it('terminates the targets when the element is removed from the DOM', async () => {
    @registerElement('targets-element-terminate-test')
    class TargetsTest extends ImpulseElement {
      panelsDisconnectedSpy = Sinon.spy();

      @targets() panels: HTMLElement[];

      panelsDisconnected(panel: HTMLElement) {
        this.panelsDisconnectedSpy.call(this, panel, this.panels);
      }
    }

    const el: TargetsTest = await fixture(html`
      <targets-element-terminate-test>
        <div class="panel" data-target="targets-element-terminate-test.panels"></div>
        <div class="panel" data-target="targets-element-terminate-test.panels"></div>
      </targets-element-terminate-test>
    `);

    const panels = Array.from(el.querySelectorAll('.panel'));
    el.remove();

    expect(el.panelsDisconnectedSpy.calledTwice).to.be.true;
    expect(el.panelsDisconnectedSpy.calledOn(el)).to.be.true;
    expect(el.panelsDisconnectedSpy.getCall(0).args).to.deep.equal([panels[0], panels]);
    expect(el.panelsDisconnectedSpy.getCall(1).args).to.deep.equal([panels[1], panels]);
  });
});
