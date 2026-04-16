import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import Sinon from 'sinon';
import { emit, on } from '../src';

describe('on', () => {
  it('sets up an event listener', async () => {
    const callback = Sinon.spy();
    const root = await fixture<HTMLButtonElement>(html`<button></button>`);
    on('click', 'button', callback);

    root.click();
    expect(callback.calledOnce).to.be.true;
    expect(callback.firstCall.args[0]).to.be.instanceOf(Event);
  });

  it('cleans up the event listener manually', async () => {
    const callback = Sinon.spy();
    const root = await fixture<HTMLButtonElement>(html`<button id="selector"></button>`);
    const stop = on('click', '#selector', callback);

    root.click();
    expect(callback.calledOnce).to.be.true;

    callback.resetHistory();
    stop();
    expect(callback.called).to.be.false;
  });

  it('cleans up the event listener when attribute itself is removed', async () => {
    const callback = Sinon.spy();
    const root = await fixture<HTMLButtonElement>(html`<button id="selector"></button>`);
    on('click', '#selector', callback);

    root.click();
    expect(callback.calledOnce).to.be.true;

    callback.resetHistory();
    root.removeAttribute('id');
    await waitUntil(() => !root.hasAttribute('id'));
    root.click();
    expect(callback.called).to.be.false;
  });

  it('supports event listener options', async () => {
    const callback = Sinon.spy();
    const root = await fixture<HTMLButtonElement>(html`<button id="selector"></button>`);
    on('click', '#selector', callback, { once: true });

    root.click();
    root.click();
    expect(callback.callCount).to.eq(1);
  });

  it('supports custom events', async () => {
    const callback = Sinon.spy();
    const root = await fixture<HTMLButtonElement>(html`<button id="selector"></button>`);
    on<CustomEvent<{ foo: string }>>('ajax:success', '#selector', callback);

    emit<{ foo: string }>(root, 'ajax:success', { detail: { foo: 'bar' } });
    expect(callback.calledOnce).to.be.true;
  });

  it('fires for elements added after registration', async () => {
    const callback = Sinon.spy();
    const root = await fixture<HTMLDivElement>(html`<div></div>`);
    on('click', '.delegated', callback);

    const button = document.createElement('button');
    button.className = 'delegated';
    root.appendChild(button);

    button.click();
    expect(callback.calledOnce).to.be.true;
    button.remove();
  });

  it('walks up ancestors to find a matching element', async () => {
    let observedCurrentTarget: EventTarget | null = null;
    const callback = Sinon.spy((event: Event) => {
      observedCurrentTarget = event.currentTarget;
    });
    const root = await fixture<HTMLDivElement>(html`
      <div class="outer">
        <span><b>inner</b></span>
      </div>
    `);
    const stop = on('click', '.outer', callback);

    const inner = root.querySelector('b')!;
    inner.click();
    expect(callback.calledOnce).to.be.true;
    expect(observedCurrentTarget).to.eq(root);
    stop();
  });

  it('honors stopPropagation between matched ancestors', async () => {
    const inner = Sinon.spy((event: Event) => event.stopPropagation());
    const outer = Sinon.spy();
    const root = await fixture<HTMLDivElement>(html`
      <div class="outer">
        <button class="inner"></button>
      </div>
    `);
    const stop1 = on('click', '.inner', inner);
    const stop2 = on('click', '.outer', outer);

    root.querySelector<HTMLButtonElement>('.inner')!.click();
    expect(inner.calledOnce).to.be.true;
    expect(outer.called).to.be.false;
    stop1();
    stop2();
  });

  it('shares one document listener across registrations for the same event', async () => {
    const spy = Sinon.spy(document, 'addEventListener');
    try {
      const stops = Array.from({ length: 5 }, (_, i) => on('shared-listener:test', `.shared-${i}`, () => {}));
      const registrations = spy.getCalls().filter((c) => c.args[0] === 'shared-listener:test');
      expect(registrations.length).to.eq(1);
      stops.forEach((s) => s());
    } finally {
      spy.restore();
    }
  });

  it('removes the document listener when the last handler is detached', async () => {
    const removeSpy = Sinon.spy(document, 'removeEventListener');
    try {
      const stop = on('transient-listener:test', '.transient', () => {});
      stop();
      const removals = removeSpy.getCalls().filter((c) => c.args[0] === 'transient-listener:test');
      expect(removals.length).to.eq(1);
    } finally {
      removeSpy.restore();
    }
  });

  it('supports capture-phase delegation', async () => {
    const callback = Sinon.spy();
    const root = await fixture<HTMLDivElement>(html`<div class="capture-host"><button></button></div>`);
    const stop = on('click', '.capture-host', callback, { capture: true });

    root.querySelector('button')!.click();
    expect(callback.calledOnce).to.be.true;
    stop();
  });

  it('can reregister after removing', async () => {
    const callback = Sinon.spy();
    const root = await fixture<HTMLButtonElement>(html`<button class="reregister"></button>`);
    const stopFirst = on('click', '.reregister', callback);
    stopFirst();
    const stopSecond = on('click', '.reregister', callback);
    root.click();
    expect(callback.callCount).to.eq(1);
    stopSecond();
  });

  it('removes capture event observers', async () => {
    const callback = Sinon.spy();
    const root = await fixture<HTMLButtonElement>(html`<button class="cap-remove"></button>`);
    const stop = on('click', '.cap-remove', callback, { capture: true });
    stop();
    root.click();
    expect(callback.called).to.be.false;
  });

  it('fires observers in tree order across capture and bubble', async () => {
    const root = await fixture<HTMLDivElement>(html`
      <div class="tree-parent">
        <div class="tree-child"></div>
      </div>
    `);
    const parent = root;
    const child = root.querySelector<HTMLDivElement>('.tree-child')!;
    const order: number[] = [];

    const captureParent = function (this: Element, event: Event) {
      expect(event.currentTarget).to.eq(parent);
      expect(this).to.eq(parent);
      order.push(1);
    };
    const captureChild = function (this: Element, event: Event) {
      expect(event.currentTarget).to.eq(child);
      expect(this).to.eq(child);
      order.push(2);
    };
    const bubbleParent = function (this: Element, event: Event) {
      expect(event.currentTarget).to.eq(parent);
      expect(this).to.eq(parent);
      order.push(3);
    };
    const bubbleChild = function (this: Element, event: Event) {
      expect(event.currentTarget).to.eq(child);
      expect(this).to.eq(child);
      order.push(4);
    };

    const stops = [
      on('tree:order', '.tree-parent', captureParent, { capture: true }),
      on('tree:order', '.tree-child', captureChild, { capture: true }),
      on('tree:order', '.tree-parent', bubbleParent),
      on('tree:order', '.tree-child', bubbleChild),
    ];
    emit(child, 'tree:order');
    stops.forEach((s) => s());

    expect(order).to.deep.equal([1, 2, 4, 3]);
  });

  it('clears currentTarget after propagation', async () => {
    let inHandlerTarget: EventTarget | null = null;
    const callback = Sinon.spy((event: Event) => {
      inHandlerTarget = event.currentTarget;
    });
    const root = await fixture<HTMLBodyElement>(html`<div class="clear-host"></div>`);
    const stop = on('clear:test', '.clear-host', callback);

    const event = new CustomEvent('clear:test', { bubbles: true });
    root.dispatchEvent(event);
    expect(callback.calledOnce).to.be.true;
    expect(inHandlerTarget).to.eq(root);
    expect(event.currentTarget).to.eq(null);
    stop();
  });

  it('does not interfere with currentTarget on directly-attached listeners', async () => {
    const root = await fixture<HTMLDivElement>(html`
      <div class="ct-parent">
        <div class="ct-child"></div>
      </div>
    `);
    const parent = root;
    const child = root.querySelector<HTMLDivElement>('.ct-child')!;

    const delegated = Sinon.spy((event: Event) => {
      expect(event.currentTarget).to.eq(parent);
    });
    const direct = Sinon.spy((event: Event) => {
      expect(event.currentTarget).to.eq(parent);
    });

    const stop = on('ct:test', '.ct-parent', delegated, { capture: true });
    parent.addEventListener('ct:test', direct);

    const event = new CustomEvent('ct:test', { bubbles: true });
    child.dispatchEvent(event);
    expect(delegated.calledOnce).to.be.true;
    expect(direct.calledOnce).to.be.true;
    expect(event.currentTarget).to.eq(null);

    stop();
    parent.removeEventListener('ct:test', direct);
  });

  it('prevents redispatch after propagation is stopped', async () => {
    const callback = Sinon.spy((event: Event) => event.stopPropagation());
    const root = await fixture<HTMLDivElement>(html`<div class="redispatch"></div>`);
    const stop = on('redispatch:test', '.redispatch', callback);

    const event = new CustomEvent('redispatch:test', { bubbles: true });
    root.dispatchEvent(event);
    expect(callback.callCount).to.eq(1);
    root.dispatchEvent(event);
    expect(callback.callCount).to.eq(1);
    stop();
  });

  it('stops propagation between matched ancestors via stopPropagation', async () => {
    const root = await fixture<HTMLDivElement>(html`
      <div class="bubble-parent">
        <div class="bubble-child"></div>
      </div>
    `);
    const child = root.querySelector<HTMLDivElement>('.bubble-child')!;

    const parentSpy = Sinon.spy();
    const childSpy = Sinon.spy((event: Event) => event.stopPropagation());

    const stops = [
      on('bubble:test', '.bubble-parent', parentSpy),
      on('bubble:test', '.bubble-child', childSpy),
    ];
    emit(child, 'bubble:test');
    expect(childSpy.calledOnce).to.be.true;
    expect(parentSpy.called).to.be.false;
    stops.forEach((s) => s());
  });

  it('stopPropagation does not block siblings on the same node', async () => {
    const root = await fixture<HTMLDivElement>(html`<div class="same-node"></div>`);
    const first = Sinon.spy((event: Event) => event.stopPropagation());
    const second = Sinon.spy();

    const stops = [
      on('same:test', '.same-node', first),
      on('same:test', '.same-node', second),
    ];
    emit(root, 'same:test');
    expect(first.calledOnce).to.be.true;
    expect(second.calledOnce).to.be.true;
    stops.forEach((s) => s());
  });

  it('stopImmediatePropagation blocks remaining handlers on the same node', async () => {
    const root = await fixture<HTMLDivElement>(html`<div class="immediate-node"></div>`);
    const first = Sinon.spy((event: Event) => event.stopImmediatePropagation());
    const second = Sinon.spy();

    const stops = [
      on('immediate:test', '.immediate-node', first),
      on('immediate:test', '.immediate-node', second),
    ];
    emit(root, 'immediate:test');
    expect(first.calledOnce).to.be.true;
    expect(second.called).to.be.false;
    stops.forEach((s) => s());
  });

  it('snapshots selector matches before invoking handlers', async () => {
    const root = await fixture<HTMLDivElement>(html`<div class="snap-target inactive"></div>`);
    const flipper = Sinon.spy((event: Event) => {
      const el = event.currentTarget as Element;
      el.classList.remove('inactive');
      el.classList.add('active');
    });
    const shouldNotFire = Sinon.spy();

    const stops = [
      on('snap:test', '.snap-target.inactive', flipper),
      on('snap:test', '.snap-target.active', shouldNotFire),
    ];
    emit(root, 'snap:test');
    expect(flipper.calledOnce).to.be.true;
    expect(shouldNotFire.called).to.be.false;
    stops.forEach((s) => s());
  });
});

describe('emit', () => {
  it('emits an event', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div></div>`);
    document.addEventListener('emit-test:change', callback);

    emit(root, 'emit-test:change');
    expect(callback.calledOnce).to.be.true;
    expect(callback.getCall(0).args[0].detail).to.deep.equal({});
  });

  it('sets the detail', async () => {
    const callback = Sinon.spy();
    const root = await fixture(html`<div></div>`);
    document.addEventListener('emit-test:change', callback);

    emit<{ name: string }>(root, 'emit-test:change', { detail: { name: 'John' } });
    expect(callback.calledOnce).to.be.true;
    expect(callback.getCall(0).args[0].detail).to.deep.equal({ name: 'John' });
  });

  it('returns canceled when default is prevented', async () => {
    const root = await fixture<HTMLDivElement>(html`<div></div>`);
    const observer = (event: Event) => event.preventDefault();
    document.addEventListener('cancel:test', observer);
    const event = emit(root, 'cancel:test', { cancelable: true });
    expect(event.defaultPrevented).to.be.true;
    document.removeEventListener('cancel:test', observer);
  });

  it('is not canceled when no handler prevents default', async () => {
    const root = await fixture<HTMLDivElement>(html`<div></div>`);
    const event = emit(root, 'noncancel:test', { cancelable: true });
    expect(event.defaultPrevented).to.be.false;
  });
});
