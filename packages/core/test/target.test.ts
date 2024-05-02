import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import Sinon from 'sinon';
import { ImpulseElement, registerElement, target } from '../src';

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
});
