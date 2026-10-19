import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import Sinon from 'sinon';
import { connected, ImpulseElement, registerElement, targets } from '../src';

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

  it('should persist the DOM order', async () => {
    const panel = document.createElement('div');
    panel.setAttribute('data-target', `${el.identifier}.panels`);
    panel.id = 'panel-mid';
    panel.classList.add('panel');

    const panel1 = document.getElementById('panel1')!;
    panel1.after(panel);
    await waitUntil(() => document.getElementById('panel-mid'));

    expect(el.panels.map((p) => p.id)).to.deep.equal(['panel1', 'panel-mid', 'panel2']);
  });

  it('should persist the DOM order after a target is disconnected', async () => {
    // Insert out of document order so the insertion order the targets are remembered in cannot pass for document order.
    const last = document.createElement('div');
    last.setAttribute('data-target', `${el.identifier}.panels`);
    last.id = 'panel-last';
    last.classList.add('panel');
    el.append(last);
    await nextFrame();

    const middle = document.createElement('div');
    middle.setAttribute('data-target', `${el.identifier}.panels`);
    middle.id = 'panel-mid';
    middle.classList.add('panel');
    document.getElementById('panel1')!.after(middle);
    await nextFrame();

    document.getElementById('panel2')!.remove();
    await nextFrame();

    expect(el.panels.map((p) => p.id)).to.deep.equal(['panel1', 'panel-mid', 'panel-last']);
  });

  it('should persist the DOM order when a target is inserted and the last one removed in the same task', async () => {
    const last = document.createElement('div');
    last.setAttribute('data-target', `${el.identifier}.panels`);
    last.id = 'panel-last';
    el.append(last);
    await nextFrame();

    // The insertion is delivered while `panel-last` is still remembered but already detached, so comparing against it
    // says nothing about where `panel-mid` belongs.
    const middle = document.createElement('div');
    middle.setAttribute('data-target', `${el.identifier}.panels`);
    middle.id = 'panel-mid';
    document.getElementById('panel1')!.after(middle);
    last.remove();
    await nextFrame();

    expect(el.panels.map((p) => p.id)).to.deep.equal(['panel1', 'panel-mid', 'panel2']);
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

  it('should call the [target]Connected callback if target identifier is added', async () => {
    const div = document.getElementById('panel1')!;
    div.setAttribute('data-target', `${el.identifier}.panels ${el.identifier}.sheets`);
    await nextFrame();
    expect(el.sheetsConnectedSpy.calledOnce).to.be.true;
    expect(el.panelsDisconnectedSpy.called).to.be.false;
  });

  it('should call the [target]Disconnected callback if target identifier is removed', async () => {
    const div = document.getElementById('panel1')!;
    div.setAttribute('data-target', '');
    await nextFrame();
    expect(el.panelsDisconnectedSpy.calledOnce).to.be.true;
  });

  it('should call the [target]Disconnected callback if data-target is removed', async () => {
    const div = document.getElementById('panel1')!;
    div.setAttribute('data-target', `${el.identifier}.panels ${el.identifier}.sheets`);
    await nextFrame();
    div.removeAttribute('data-target');
    await nextFrame();
    expect(el.panelsDisconnectedSpy.calledOnce).to.be.true;
    expect(el.sheetsDisconnectedSpy.calledOnce).to.be.true;
  });

  it('should not call the [target]Disconnected callback if the identifier do not match', () => {
    const div = document.createElement('div');
    div.setAttribute('data-target', 'unknown-identifier.sheets');
    el.append(div);
    div.remove();

    expect(el.sheetsDisconnectedSpy.notCalled).to.be.true;
  });

  describe('when read in the same task as a DOM change', () => {
    function createPanel(id: string): HTMLElement {
      const panel = document.createElement('div');
      panel.id = id;
      panel.setAttribute('data-target', 'targets-test.panels');
      return panel;
    }

    it('should include a target inserted before the read', () => {
      const inserted = createPanel('panel-new');
      el.append(inserted);

      expect(el.panels.map((p) => p.id)).to.deep.equal(['panel1', 'panel2', 'panel-new']);
    });

    it('should keep document order for a target inserted between two others', () => {
      document.getElementById('panel1')!.after(createPanel('panel-mid'));

      expect(el.panels.map((p) => p.id)).to.deep.equal(['panel1', 'panel-mid', 'panel2']);
    });

    it('should leave out a target inserted into a nested element of the same tag', () => {
      const nested = el.querySelector<TargetsTest>('targets-test')!;
      nested.append(createPanel('panel-nested'));

      expect(el.panels.map((p) => p.id)).to.deep.equal(['panel1', 'panel2']);
      expect(nested.panels.map((p) => p.id)).to.deep.equal(['panel3', 'panel4', 'panel-nested']);
    });

    it('should leave out a target whose data-target stops listing the field', () => {
      document.getElementById('panel1')!.setAttribute('data-target', 'targets-test.sheets');

      expect(el.panels.map((p) => p.id)).to.deep.equal(['panel2']);
      expect(el.sheets.map((p) => p.id)).to.deep.equal(['panel1']);
    });

    it('should read a descriptor with a segment past the field as the field', () => {
      const panel = createPanel('panel-new');
      panel.setAttribute('data-target', 'targets-test.panels.ignored');
      el.append(panel);

      expect(el.panels.map((p) => p.id)).to.deep.equal(['panel1', 'panel2', 'panel-new']);
    });

    it('should hand out the same array until the DOM changes again', () => {
      el.append(createPanel('panel-new'));
      const first = el.panels;
      expect(el.panels).to.equal(first);

      el.append(createPanel('panel-newer'));
      expect(el.panels).not.to.equal(first);
    });

    it('should hand out the same array when an unrelated change is waiting too', () => {
      el.append(createPanel('panel-new'));
      const first = el.panels;
      el.append(document.createElement('span'));

      expect(el.panels).to.equal(first);
    });

    it('should read the same targets before and after the change is delivered', async () => {
      document.getElementById('panel2')!.remove();
      document.getElementById('panel1')!.before(createPanel('panel-first'));
      const before = el.panels.map((p) => p.id);

      await Promise.resolve();
      expect(el.panels.map((p) => p.id)).to.deep.equal(before);
    });

    it('should leave out a target removed before the read', () => {
      document.getElementById('panel1')!.remove();

      expect(el.panels.map((p) => p.id)).to.deep.equal(['panel2']);
    });

    it('should run the callbacks for the change when it is delivered, not during the read', async () => {
      const removed = document.getElementById('panel1')!;
      const inserted = createPanel('panel-new');
      removed.remove();
      el.append(inserted);

      expect(el.panels.map((p) => p.id)).to.deep.equal(['panel2', 'panel-new']);
      expect(el.panelsDisconnectedSpy.called).to.be.false;
      expect(el.panelsConnectedSpy.calledWith(inserted)).to.be.false;

      await Promise.resolve();
      expect(el.panelsDisconnectedSpy.calledOnceWith(removed)).to.be.true;
      expect(el.panelsConnectedSpy.calledWith(inserted)).to.be.true;
    });

    it('should let the code that read the field finish before [targets]Connected runs', async () => {
      const states: (string | undefined)[] = [];
      el.panelsConnectedSpy = Sinon.spy(() => states.push(el.dataset.state));
      el.append(createPanel('panel-new'));
      expect(el.panels).to.have.length(3);
      el.dataset.state = 'set after the read';

      await Promise.resolve();
      expect(states).to.deep.equal(['set after the read']);
    });
  });

  describe('when a [targets]Connected callback run as the element starts changes the DOM, reads the field and calls connected()', () => {
    @registerElement('targets-replay-test')
    class TargetsReplayTest extends ImpulseElement {
      @targets() items: HTMLElement[];
      connectedItems = new Set<HTMLElement>();
      itemsReadByCallback: string[] = [];
      stopWatchingElsewhere?: () => void;

      itemsConnected(item: HTMLElement) {
        this.connectedItems.add(item);
        if (item.id !== 'first') return;
        this.querySelector('#second')!.remove();
        const third = document.createElement('div');
        third.id = 'third';
        third.setAttribute('data-target', 'targets-replay-test.items');
        this.append(third);
        this.itemsReadByCallback = this.items.map((i) => i.id);
        this.stopWatchingElsewhere = connected('.watched-elsewhere', () => {});
      }

      itemsDisconnected(item: HTMLElement) {
        this.connectedItems.delete(item);
      }
    }

    let replayed: TargetsReplayTest;
    beforeEach(async () => {
      replayed = await fixture(html`
        <targets-replay-test>
          <div id="first" data-target="targets-replay-test.items"></div>
          <div id="second" data-target="targets-replay-test.items"></div>
        </targets-replay-test>
      `);
      await nextFrame();
    });
    afterEach(() => replayed.stopWatchingElsewhere?.());

    it('should show the callback the targets started so far', () => {
      expect(replayed.itemsReadByCallback).to.deep.equal(['first']);
    });

    it('should end with the targets the DOM holds, each connected once', () => {
      expect(replayed.items.map((i) => i.id)).to.deep.equal(['first', 'third']);
      expect(Array.from(replayed.connectedItems, (i) => i.id)).to.deep.equal(['first', 'third']);
    });
  });
});
