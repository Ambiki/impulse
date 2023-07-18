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

    it('fires the connected callbacks in order', () => {
      expect(el.connectedSpy.calledAfter(el.panelConnectedSpy)).to.be.true;
      expect(el.connectedSpy.calledAfter(el.sheetsConnectedSpy)).to.be.true;
    });

    it('fires the disconnected callbacks in order', () => {
      el.remove();
      expect(el.disconnectedSpy.calledAfter(el.panelDisconnectedSpy)).to.be.true;
      expect(el.disconnectedSpy.calledAfter(el.sheetsDisconnectedSpy)).to.be.true;
    });
  });

  describe('emit', () => {
    @registerElement('element-emit-test')
    class ElementTest extends ImpulseElement {
      @target() panel: HTMLElement;
    }

    let el: ElementTest;
    beforeEach(async () => {
      el = await fixture(html`
        <element-emit-test>
          <div data-target="element-emit-test.panel"></div>
        </element-emit-test>
      `);
    });

    it('emits a custom event', () => {
      const handleChange = Sinon.spy();
      document.addEventListener('element-emit-test:change', handleChange);
      el.emit('change');

      expect(handleChange).to.have.callCount(1);
      expect(handleChange.getCall(0).args[0] instanceof CustomEvent).to.be.true;
    });

    it('prefix can be changed', () => {
      const handleChange = Sinon.spy();
      document.addEventListener('foo:change', handleChange);
      el.emit('change', { prefix: 'foo' });

      expect(handleChange).to.have.callCount(1);
    });

    it('prefix can be removed', () => {
      const handleChange = Sinon.spy();
      document.addEventListener('change', handleChange);
      el.emit('change', { prefix: false });

      expect(handleChange).to.have.callCount(1);
    });

    it('detail defaults to an empty object', () => {
      const handleChange = Sinon.spy();
      document.addEventListener('element-emit-test:change', handleChange);
      el.emit('change');

      expect(handleChange).to.have.callCount(1);
      expect(handleChange.getCall(0).args[0].detail).to.deep.equal({});
    });

    it('detail can be set', () => {
      const handleChange = Sinon.spy();
      document.addEventListener('element-emit-test:change', handleChange);
      el.emit<Record<string, string>>('change', { detail: { foo: 'bar' } });

      expect(handleChange).to.have.callCount(1);
      expect(handleChange.getCall(0).args[0].detail).to.deep.equal({ foo: 'bar' });
    });

    it('target can be changed', () => {
      const handleChange = Sinon.spy();
      el.panel.addEventListener('element-emit-test:change', handleChange);
      el.emit('change', { target: el.panel });

      expect(handleChange).to.have.callCount(1);
      expect(handleChange.getCall(0).args[0].detail).to.deep.equal({});
    });
  });
});
