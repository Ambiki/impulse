import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import Sinon from 'sinon';
import { ImpulseElement, registerElement, targets } from '../src';

describe('@targets', () => {
  @registerElement('targets-test')
  class TargetsTest extends ImpulseElement {
    connectedSpy = Sinon.spy();
    disconnectedSpy = Sinon.spy();
    panelsConnectedSpy = Sinon.spy();
    panelsDisconnectedSpy = Sinon.spy();
    sheetsConnectedSpy = Sinon.spy();
    sheetsDisconnectedSpy = Sinon.spy();

    @targets() panels: HTMLElement[];
    @targets() buttons: HTMLButtonElement[];
    @targets() sheets: HTMLElement[];

    connected() {
      this.connectedSpy();
    }

    disconnected() {
      this.disconnectedSpy();
    }

    panelsConnected(panel: HTMLElement) {
      this.panelsConnectedSpy(panel, this.panels);
    }

    panelsDisconnected(panel: HTMLElement) {
      this.panelsDisconnectedSpy(panel, this.panels);
    }

    sheetsConnected(sheet: HTMLElement) {
      this.sheetsConnectedSpy(sheet, this.sheets);
    }

    sheetsDisconnected(sheet: HTMLElement) {
      this.sheetsDisconnectedSpy(sheet, this.sheets);
    }
  }

  let el: TargetsTest;
  beforeEach(async () => {
    el = await fixture(html`
      <targets-test>
        <div id="panel1" class="panel" data-target="targets-test.panels"></div>
        <div id="panel2" class="panel" data-target="targets-test.panels"></div>
        <targets-test>
          <div id="panel3" class="child-panel" data-target="targets-test.panels"></div>
          <div id="panel4" class="child-panel" data-target="targets-test.panels"></div>
        </targets-test>
      </targets-test>
    `);
  });

  it('should be able to reference the targets', () => {
    expect(el.panels).to.deep.equal(Array.from(el.querySelectorAll('.panel')));
    expect(el.buttons).to.eql([]);

    const el2 = el.querySelector<TargetsTest>('targets-test')!;
    expect(el2.panels).to.deep.equal(Array.from(el2.querySelectorAll('.child-panel')));
    expect(el2.buttons).to.eql([]);
  });

  it('should call the lifecycle callback function when target is connected to the DOM', () => {
    const panels = Array.from(el.querySelectorAll('.panel'));

    expect(el.panelsConnectedSpy.calledTwice).to.be.true;
    expect(el.panelsConnectedSpy.getCall(0).args).to.deep.equal([panels[0], [panels[0]]]); // There is only one panel right now.
    expect(el.panelsConnectedSpy.getCall(1).args).to.deep.equal([panels[1], panels]); // There are two panels now.

    const el2 = el.querySelector<TargetsTest>('targets-test')!;
    const panels2 = Array.from(el2.querySelectorAll('.child-panel'));

    expect(el2.panelsConnectedSpy.calledTwice).to.be.true;
    expect(el2.panelsConnectedSpy.getCall(0).args).to.deep.equal([panels2[0], [panels2[0]]]); // There is only one panel right now.
    expect(el2.panelsConnectedSpy.getCall(1).args).to.deep.equal([panels2[1], panels2]); // There are two panels now.
  });

  it('should call the lifecycle callback function when a target is inserted to the DOM', async () => {
    const panel = document.createElement('div');
    panel.setAttribute('data-target', `${el.identifier}.panels`);
    panel.classList.add('panel');
    el.append(panel);

    await waitUntil(() => el.panelsConnectedSpy.called);
    expect(el.panelsConnectedSpy.calledWith(panel, Array.from(el.querySelectorAll('.panel')))).to.be.true;

    const panel2 = document.createElement('div');
    panel2.setAttribute('data-target', `${el.identifier}.panels`);
    panel2.classList.add('panel');
    el.append(panel);

    await waitUntil(() => el.panelsConnectedSpy.called);
    expect(el.panelsConnectedSpy.calledWith(panel, Array.from(el.querySelectorAll('.panel')))).to.be.true;
  });

  it('should call the child lifecycle callback function when a target is inserted to the DOM', async () => {
    const el2 = el.querySelector<TargetsTest>('targets-test')!;
    const panel = document.createElement('div');
    panel.setAttribute('data-target', `${el2.identifier}.panels`);
    panel.classList.add('child-panel');
    el2.append(panel);

    await waitUntil(() => el.panelsConnectedSpy.called);
    expect(el2.panelsConnectedSpy.calledWith(panel, Array.from(el2.querySelectorAll('.child-panel')))).to.be.true;
    expect(el.panelsConnectedSpy.calledTwice).to.be.true;
  });

  it('should call the connected callback after [targets]Connected callback', () => {
    expect(el.connectedSpy.calledAfter(el.panelsConnectedSpy)).to.be.true;
  });

  it('should not call the [target]Connected callback if the identifier do not match', () => {
    const div = document.createElement('div');
    div.setAttribute('data-target', 'unknown-identifier.sheets');
    el.append(div);

    expect(el.sheetsConnectedSpy.notCalled).to.be.true;
  });

  it('should call the lifecycle callback function when target is disconnected from the DOM', () => {
    el.remove();
    expect(el.panelsConnectedSpy.calledTwice).to.be.true;
    expect(el.sheetsConnectedSpy.notCalled).to.be.true;

    const el2 = el.querySelector<TargetsTest>('targets-test')!;
    expect(el2.panelsConnectedSpy.calledTwice).to.be.true;
    expect(el2.sheetsConnectedSpy.notCalled).to.be.true;
  });

  it('should call the lifecycle callback function when a target is removed from the DOM', async () => {
    const panel = el.querySelector('#panel1')!;
    panel.remove();

    await waitUntil(() => el.panelsDisconnectedSpy.called);
    expect(el.panelsDisconnectedSpy.calledOnceWith(panel, [panel, el.querySelector('#panel2')])).to.be.true;
  });

  it('should call the lifecycle callback function when a target is removed from the DOM for an inserted target', async () => {
    const sheet = document.createElement('div');
    sheet.setAttribute('data-target', `${el.identifier}.sheets`);
    el.append(sheet);

    await waitUntil(() => el.sheetsConnectedSpy.called);
    expect(el.sheetsConnectedSpy.called).to.be.true;

    sheet.remove();

    await waitUntil(() => el.sheetsDisconnectedSpy.called);
    expect(el.sheetsDisconnectedSpy.calledWith(sheet, [sheet])).to.be.true;
  });

  it('should call the child lifecycle callback function when a target is removed from the DOM', async () => {
    const el2 = el.querySelector<TargetsTest>('targets-test')!;
    const panel = el.querySelector('#panel3')!;
    panel.remove();

    await waitUntil(() => el2?.panelsDisconnectedSpy.called);
    expect(el2.panelsDisconnectedSpy.calledOnceWith(panel, [panel, el2.querySelector('#panel4')])).to.be.true;
    expect(el.panelsDisconnectedSpy.notCalled).to.be.true;
  });

  it('should call the disconnected callback before [target]Disconnected callback', () => {
    el.remove();
    expect(el.panelsDisconnectedSpy.calledAfter(el.disconnectedSpy)).to.be.true;
  });

  it('should not call the [target]Disconnected callback if the identifier do not match', () => {
    const div = document.createElement('div');
    div.setAttribute('data-target', 'unknown-identifier.sheets');
    el.append(div);
    div.remove();

    expect(el.sheetsDisconnectedSpy.notCalled).to.be.true;
  });
});
