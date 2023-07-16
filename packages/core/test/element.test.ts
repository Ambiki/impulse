import { expect, fixture, html } from '@open-wc/testing';
import Sinon from 'sinon';
import { ImpulseElement, registerElement, target, targets } from '../src';

describe('ImpulseElement', () => {
  describe('callbacks', () => {
    @registerElement('element-connected-callback')
    class ElementTest extends ImpulseElement {
      connectedSpy = Sinon.spy();
      disconnectedSpy = Sinon.spy();
      panelConnectedSpy = Sinon.spy();
      panelDisconnectedSpy = Sinon.spy();
      sheetsConnectedSpy = Sinon.spy();
      sheetsDisconnectedSpy = Sinon.spy();

      @target() panel: HTMLElement;
      @targets() sheets: HTMLElement[];

      connected() {
        this.connectedSpy();
      }

      disconnected() {
        this.disconnectedSpy();
      }

      panelConnected() {
        this.panelConnectedSpy();
      }

      panelDisconnected() {
        this.panelDisconnectedSpy();
      }

      sheetsConnected() {
        this.sheetsConnectedSpy();
      }

      sheetsDisconnected() {
        this.sheetsDisconnectedSpy();
      }
    }

    let el: ElementTest;
    beforeEach(async () => {
      el = await fixture(html`
        <element-connected-callback>
          <div data-target="element-connected-callback.panel"></div>
          <div data-target="element-connected-callback.sheets"></div>
        </element-connected-callback>
      `);
    });

    it('fires the connected callbacks in order', async () => {
      expect(el.connectedSpy.calledAfter(el.panelConnectedSpy)).to.be.true;
      expect(el.connectedSpy.calledAfter(el.sheetsConnectedSpy)).to.be.true;
    });

    it('fires the disconnected callbacks in order', async () => {
      el.remove();
      expect(el.disconnectedSpy.calledAfter(el.panelDisconnectedSpy)).to.be.true;
      expect(el.disconnectedSpy.calledAfter(el.sheetsDisconnectedSpy)).to.be.true;
    });
  });
});
