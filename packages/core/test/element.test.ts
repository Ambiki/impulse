import { expect, fixture, html } from '@open-wc/testing';
import Sinon from 'sinon';
import { ImpulseElement, registerElement, target } from '../src';

describe('ImpulseElement', () => {
  describe('callbacks', () => {
    @registerElement('element-connected-callback')
    class ElementTest extends ImpulseElement {
      connectedSpy = Sinon.spy();
      disconnectedSpy = Sinon.spy();
      panelConnectedSpy = Sinon.spy();
      panelDisconnectedSpy = Sinon.spy();

      @target() panel: HTMLElement;

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
    }

    let el: ElementTest;
    beforeEach(async () => {
      el = await fixture(html`
        <element-connected-callback>
          <div id="panel1" data-target="element-connected-callback.panel"></div>
        </element-connected-callback>
      `);
    });

    it('fires the connected callbacks in order', async () => {
      expect(el.connectedSpy.calledAfter(el.panelConnectedSpy)).to.be.true;
    });

    it('fires the disconnected callbacks in order', async () => {
      el.remove();
      expect(el.disconnectedSpy.calledAfter(el.panelDisconnectedSpy)).to.be.true;
    });
  });
});
