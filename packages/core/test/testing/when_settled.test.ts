import { expect } from '@open-wc/testing';
import Sinon from 'sinon';
import { ImpulseElement, isInitialized, registerElement, targets } from '../../src';
import { whenSettled } from '../../src/testing';
import { appendMarkup, defineImpulseElement, rejectionOf, removeAppended, uniqueTag } from './support';

// `document.createElement('button', { is })` and `<button is>` make a customized built-in, which WebKit (and jsdom)
// does not support.
const supportsCustomizedBuiltIns = document.createElement('button', { is: 'probe-button' }).matches(':not(:defined)');

describe('whenSettled', () => {
  afterEach(() => removeAppended());

  it('resolves once an appended Impulse element is initialized', async () => {
    const tag = defineImpulseElement('settled-appended');
    const element = appendMarkup(`<${tag}></${tag}>`);
    expect(isInitialized(element)).to.be.false;

    await whenSettled();
    expect(isInitialized(element)).to.be.true;
  });

  it('resolves once every nested Impulse element is initialized', async () => {
    const outer = defineImpulseElement('settled-outer');
    const inner = defineImpulseElement('settled-inner');
    const element = appendMarkup(`<${outer}><${inner}></${inner}><div><${inner}></${inner}></div></${outer}>`);

    await whenSettled();
    const elements = [element, ...element.querySelectorAll(inner)];
    expect(elements.map((each) => isInitialized(each))).to.eql([true, true, true]);
  });

  describe('after a change to the DOM', () => {
    @registerElement('settled-group')
    class SettledGroup extends ImpulseElement {
      @targets() items: HTMLElement[];
      log: string[] = [];

      itemsConnected(item: HTMLElement) {
        this.log.push(`connected ${item.id}`);
      }

      itemsDisconnected(item: HTMLElement) {
        this.log.push(`disconnected ${item.id}`);
      }
    }

    it('resolves once an added target is delivered', async () => {
      const group = appendMarkup<SettledGroup>('<settled-group></settled-group>');
      await whenSettled();

      const item = document.createElement('div');
      item.id = 'added';
      item.setAttribute('data-target', 'settled-group.items');
      group.append(item);
      expect(group.log).to.eql([]);

      await whenSettled();
      expect(group.log).to.eql(['connected added']);
    });

    it('resolves once a removed target is delivered', async () => {
      const group = appendMarkup<SettledGroup>(
        '<settled-group><div id="removed" data-target="settled-group.items"></div></settled-group>',
      );
      await whenSettled();
      group.log.length = 0;

      group.querySelector('#removed')!.remove();
      expect(group.log).to.eql([]);

      await whenSettled();
      expect(group.log).to.eql(['disconnected removed']);
    });

    it('resolves once a removed Impulse element is torn down', async () => {
      const disconnected = Sinon.spy();
      const tag = defineImpulseElement('settled-removed', class extends ImpulseElement {
        disconnected() {
          disconnected();
        }
      });
      const element = appendMarkup(`<${tag}></${tag}>`);
      await whenSettled();

      element.remove();
      await whenSettled();
      expect(disconnected.calledOnce).to.be.true;
      expect(isInitialized(element)).to.be.false;
    });
  });

  it('waits for a custom element to be defined', async () => {
    const tag = uniqueTag('settled-defined-later');
    const element = appendMarkup(`<${tag}></${tag}>`);
    setTimeout(() => customElements.define(tag, class extends HTMLElement {}), 20);

    await whenSettled();
    expect(element.matches(':defined')).to.be.true;
  });

  it('waits for an Impulse element defined later to be initialized', async () => {
    const tag = uniqueTag('settled-impulse-later');
    const element = appendMarkup(`<${tag}></${tag}>`);
    setTimeout(() => customElements.define(tag, class extends ImpulseElement {}), 20);

    await whenSettled();
    expect(isInitialized(element)).to.be.true;
  });

  it('resolves once an element it was waiting for is removed', async () => {
    const tag = uniqueTag('settled-removed-undefined');
    const element = appendMarkup(`<${tag}></${tag}>`);
    setTimeout(() => element.remove(), 20);

    await whenSettled();
    expect(element.isConnected).to.be.false;
  });

  it('rejects at the deadline, naming an element that is not defined', async () => {
    const tag = uniqueTag('settled-typo');
    appendMarkup(`<${tag}></${tag}><${tag}></${tag}>`);

    const error = await rejectionOf(whenSettled({ timeout: 50 }));
    expect(error.message).to.equal(`Not settled within 50ms: <${tag}> is not defined.`);
  });

  it('rejects at the deadline, naming an Impulse element that is not initialized', async () => {
    const missing = uniqueTag('settled-missing');
    const host = defineImpulseElement('settled-host', class extends ImpulseElement {
      // The host waits for its descendants to be defined (the deprecated wait). This silences its warning.
      static migratedToWhenInitialized = true;
    });
    appendMarkup(`<${host}><${missing}></${missing}></${host}>`);

    const error = await rejectionOf(whenSettled({ timeout: 50 }));
    expect(error.message).to.equal(
      `Not settled within 50ms: <${missing}> is not defined; <${host}> is not initialized.`,
    );
  });

  it('has a deadline of 1000ms by default', async () => {
    const tag = uniqueTag('settled-default-deadline');
    appendMarkup(`<${tag}></${tag}>`);

    const started = Date.now();
    const error = await rejectionOf(whenSettled());
    expect(error.message).to.equal(`Not settled within 1000ms: <${tag}> is not defined.`);
    // A timer can fire a millisecond before `Date.now()` says it is due.
    expect(Date.now() - started).to.be.at.least(990);
  });

  it('ignores a custom element whose name can never be defined', async () => {
    const row = appendMarkup('<table><tbody><tr is="vue:row"></tr></tbody></table>').querySelector('tr')!;
    expect(row).to.exist;

    await whenSettled({ timeout: 0 });
  });

  (supportsCustomizedBuiltIns ? describe : describe.skip)('with a customized built-in element', () => {
    it('waits for it to be defined', async () => {
      const name = uniqueTag('settled-fancy-button');
      const button = appendMarkup(`<button is="${name}"></button>`);
      setTimeout(() => customElements.define(name, class extends HTMLButtonElement {}, { extends: 'button' }), 20);

      await whenSettled();
      expect(button.matches(':defined')).to.be.true;
    });

    it('names one that is not defined by its tag and its `is`', async () => {
      const name = uniqueTag('settled-missing-button');
      appendMarkup(`<button is="${name}"></button>`);

      const error = await rejectionOf(whenSettled({ timeout: 50 }));
      expect(error.message).to.equal(`Not settled within 50ms: <button is="${name}"> is not defined.`);
    });

    it('names one created with `document.createElement()`, which has no `is` attribute', async () => {
      const name = uniqueTag('settled-created-button');
      const container = appendMarkup('<div></div>');
      container.append(document.createElement('button', { is: name }));

      const error = await rejectionOf(whenSettled({ timeout: 50 }));
      expect(error.message).to.equal(`Not settled within 50ms: <button is="${name}"> is not defined.`);
    });
  });

  describe('in a shadow tree', () => {
    it('waits for an Impulse element in an open shadow root', async () => {
      const tag = defineImpulseElement('settled-shadowed');
      const host = appendMarkup('<div></div>');
      const root = host.attachShadow({ mode: 'open' });
      root.innerHTML = `<${tag}></${tag}>`;

      await whenSettled();
      expect(isInitialized(root.firstElementChild!)).to.be.true;
    });

    it('names an element that is not defined in a nested open shadow root', async () => {
      const tag = uniqueTag('settled-shadowed-typo');
      const host = appendMarkup('<div></div>');
      const inner = host.attachShadow({ mode: 'open' }).appendChild(document.createElement('div'));
      inner.attachShadow({ mode: 'open' }).innerHTML = `<${tag}></${tag}>`;

      const error = await rejectionOf(whenSettled({ timeout: 50 }));
      expect(error.message).to.equal(`Not settled within 50ms: <${tag}> is not defined.`);
    });
  });

  describe('with fake timers', () => {
    let clock: Sinon.SinonFakeTimers;
    beforeEach(() => {
      clock = Sinon.useFakeTimers();
    });
    afterEach(() => clock.restore());

    it('waits with the timers it captured when imported', async () => {
      const tag = defineImpulseElement('settled-fake-timers');
      const element = appendMarkup(`<${tag}></${tag}>`);

      await whenSettled();
      expect(isInitialized(element)).to.be.true;
    });

    it('keeps to its deadline', async () => {
      const tag = uniqueTag('settled-fake-timers-typo');
      appendMarkup(`<${tag}></${tag}>`);

      const error = await rejectionOf(whenSettled({ timeout: 50 }));
      expect(error.message).to.equal(`Not settled within 50ms: <${tag}> is not defined.`);
    });
  });

  it('resolves when called again while a call is waiting', async () => {
    const tag = uniqueTag('settled-concurrent');
    const element = appendMarkup(`<${tag}></${tag}>`);
    setTimeout(() => customElements.define(tag, class extends ImpulseElement {}), 20);

    await Promise.all([whenSettled(), whenSettled()]);
    expect(isInitialized(element)).to.be.true;
  });
});
