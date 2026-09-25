import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import Sinon from 'sinon';
import { emit, on } from '../src';
import { captureReportedErrors } from './support/capture_reported_errors';

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

  it('delegates to the subject of a combinator selector', async () => {
    const callback = Sinon.spy();
    const root = await fixture<HTMLFormElement>(html`<form><button type="button"></button></form>`);
    const stop = on('click', 'form button', callback);

    root.querySelector('button')!.click();
    expect(callback.calledOnce).to.be.true;
    stop();
  });

  it('delegates to every part of a selector list', async () => {
    const callback = Sinon.spy();
    const root = await fixture<HTMLDivElement>(html`<div><span></span><b></b></div>`);
    const stop = on('click', 'span, b', callback);

    root.querySelector('span')!.click();
    root.querySelector('b')!.click();
    expect(callback.calledTwice).to.be.true;
    stop();
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

  it('removes the document listener after a once handler fires', async () => {
    const addSpy = Sinon.spy(document, 'addEventListener');
    const removeSpy = Sinon.spy(document, 'removeEventListener');
    try {
      const root = await fixture<HTMLDivElement>(html`<div class="once-release"></div>`);
      on('once-release:test', '.once-release', () => {}, { once: true });
      root.dispatchEvent(new CustomEvent('once-release:test', { bubbles: true }));

      const added = addSpy.getCalls().filter((c) => c.args[0] === 'once-release:test').length;
      const removed = removeSpy.getCalls().filter((c) => c.args[0] === 'once-release:test').length;
      expect(added).to.eq(1);
      expect(removed).to.eq(1);
    } finally {
      addSpy.restore();
      removeSpy.restore();
    }
  });

  it('removes the capture-phase document listener after a once handler fires', async () => {
    const removeSpy = Sinon.spy(document, 'removeEventListener');
    try {
      const root = await fixture<HTMLDivElement>(html`<div class="once-capture"></div>`);
      on('once-capture:test', '.once-capture', () => {}, { once: true, capture: true });
      root.dispatchEvent(new CustomEvent('once-capture:test', { bubbles: false }));

      const removals = removeSpy.getCalls().filter((c) => c.args[0] === 'once-capture:test');
      expect(removals.length).to.eq(1);
      expect(removals[0].args[2]).to.eq(true);
    } finally {
      removeSpy.restore();
    }
  });

  it('keeps the document listener when other handlers remain after a once handler fires', async () => {
    const removeSpy = Sinon.spy(document, 'removeEventListener');
    try {
      const root = await fixture<HTMLDivElement>(html`<div class="once-keep"></div>`);
      const persistent = Sinon.spy();
      const stop = on('once-keep:test', '.once-keep', persistent);
      on('once-keep:test', '.once-keep', () => {}, { once: true });
      root.dispatchEvent(new CustomEvent('once-keep:test', { bubbles: true }));

      let removed = removeSpy.getCalls().filter((c) => c.args[0] === 'once-keep:test').length;
      expect(removed).to.eq(0);

      root.dispatchEvent(new CustomEvent('once-keep:test', { bubbles: true }));
      expect(persistent.callCount).to.eq(2);

      stop();
      removed = removeSpy.getCalls().filter((c) => c.args[0] === 'once-keep:test').length;
      expect(removed).to.eq(1);
    } finally {
      removeSpy.restore();
    }
  });

  it('fires a once handler only once when its callback throws', async () => {
    const root = await fixture<HTMLDivElement>(html`<div class="once-throws"></div>`);
    const callback = Sinon.spy(() => {
      throw new Error('once-throws failed');
    });
    const errors = captureReportedErrors('once-throws failed');
    const stop = on('once-throws:test', '.once-throws', callback, { once: true });
    try {
      root.dispatchEvent(new CustomEvent('once-throws:test', { bubbles: true }));
      root.dispatchEvent(new CustomEvent('once-throws:test', { bubbles: true }));
      expect(callback.callCount).to.eq(1);
      expect(errors.reported.length).to.eq(1);
    } finally {
      stop();
      errors.release();
    }
  });

  it('keeps running later handlers when one handler throws', async () => {
    const root = await fixture<HTMLDivElement>(
      html`<div class="throws-outer"><button class="throws-button"></button></div>`,
    );
    const sameNode = Sinon.spy();
    const ancestor = Sinon.spy();
    const errors = captureReportedErrors('throws-button failed');
    const stops = [
      on('click', '.throws-button', () => {
        throw new Error('throws-button failed');
      }),
      on('click', '.throws-button', sameNode),
      on('click', '.throws-outer', ancestor),
    ];
    try {
      root.querySelector('button')!.click();
      expect(errors.reported.length).to.eq(1);
      expect(sameNode.calledOnce).to.be.true;
      expect(ancestor.calledOnce).to.be.true;
    } finally {
      stops.forEach((stop) => stop());
      errors.release();
    }
  });

  it('honors stopPropagation from a handler that then throws', async () => {
    const root = await fixture<HTMLDivElement>(
      html`<div class="throws-stop-outer"><button class="throws-stop-button"></button></div>`,
    );
    const sameNode = Sinon.spy();
    const ancestor = Sinon.spy();
    const errors = captureReportedErrors('throws-stop failed');
    const stops = [
      on('click', '.throws-stop-button', (event) => {
        event.stopPropagation();
        throw new Error('throws-stop failed');
      }),
      on('click', '.throws-stop-button', sameNode),
      on('click', '.throws-stop-outer', ancestor),
    ];
    try {
      root.querySelector('button')!.click();
      expect(errors.reported.length).to.eq(1);
      expect(sameNode.calledOnce).to.be.true;
      expect(ancestor.called).to.be.false;
    } finally {
      stops.forEach((stop) => stop());
      errors.release();
    }
  });

  it('fires a once handler only once when its callback re-dispatches the same event', async () => {
    const root = await fixture<HTMLDivElement>(html`<div class="once-redispatch"></div>`);
    let calls = 0;
    const callback = Sinon.spy(() => {
      if (calls++ === 0) root.dispatchEvent(new CustomEvent('once-redispatch:test', { bubbles: true }));
    });
    const stop = on('once-redispatch:test', '.once-redispatch', callback, { once: true });
    try {
      root.dispatchEvent(new CustomEvent('once-redispatch:test', { bubbles: true }));
      expect(callback.callCount).to.eq(1);
    } finally {
      stop();
    }
  });

  it('registers the document listener as passive when passive is requested', () => {
    const addSpy = Sinon.spy(document, 'addEventListener');
    try {
      const stop = on('passive-opt:test', '.passive-opt', () => {}, { passive: true });
      const registration = addSpy.getCalls().find((c) => c.args[0] === 'passive-opt:test');
      expect(registration?.args[2]).to.deep.include({ capture: false, passive: true });
      stop();
    } finally {
      addSpy.restore();
    }
  });

  it('forwards an explicit passive: false to the document listener', () => {
    const addSpy = Sinon.spy(document, 'addEventListener');
    try {
      const stop = on('passive-false:test', '.passive-false', () => {}, { passive: false });
      const registration = addSpy.getCalls().find((c) => c.args[0] === 'passive-false:test');
      expect(registration?.args[2]).to.deep.include({ capture: false, passive: false });
      stop();
    } finally {
      addSpy.restore();
    }
  });

  it('keeps passive and non-passive registrations in separate document listeners', () => {
    const addSpy = Sinon.spy(document, 'addEventListener');
    const removeSpy = Sinon.spy(document, 'removeEventListener');
    try {
      const stopPassive = on('passive-split:test', '.passive-split', () => {}, { passive: true });
      const stopDefault = on('passive-split:test', '.passive-split', () => {});
      expect(addSpy.getCalls().filter((c) => c.args[0] === 'passive-split:test').length).to.eq(2);

      stopPassive();
      expect(removeSpy.getCalls().filter((c) => c.args[0] === 'passive-split:test').length).to.eq(1);
      stopDefault();
      expect(removeSpy.getCalls().filter((c) => c.args[0] === 'passive-split:test').length).to.eq(2);
    } finally {
      addSpy.restore();
      removeSpy.restore();
    }
  });

  it('removes the registration when the signal aborts', async () => {
    const removeSpy = Sinon.spy(document, 'removeEventListener');
    try {
      const callback = Sinon.spy();
      const root = await fixture<HTMLDivElement>(html`<div class="signal-opt"></div>`);
      const controller = new AbortController();
      on('signal-opt:test', '.signal-opt', callback, { signal: controller.signal });

      root.dispatchEvent(new CustomEvent('signal-opt:test', { bubbles: true }));
      expect(callback.callCount).to.eq(1);

      controller.abort();
      root.dispatchEvent(new CustomEvent('signal-opt:test', { bubbles: true }));
      expect(callback.callCount).to.eq(1);
      expect(removeSpy.getCalls().filter((c) => c.args[0] === 'signal-opt:test').length).to.eq(1);
    } finally {
      removeSpy.restore();
    }
  });

  it('never registers when the signal is already aborted', async () => {
    const addSpy = Sinon.spy(document, 'addEventListener');
    try {
      const callback = Sinon.spy();
      const root = await fixture<HTMLDivElement>(html`<div class="signal-aborted"></div>`);
      const controller = new AbortController();
      controller.abort();
      const stop = on('signal-aborted:test', '.signal-aborted', callback, { signal: controller.signal });

      root.dispatchEvent(new CustomEvent('signal-aborted:test', { bubbles: true }));
      expect(callback.called).to.be.false;
      expect(addSpy.getCalls().filter((c) => c.args[0] === 'signal-aborted:test').length).to.eq(0);
      stop();
    } finally {
      addSpy.restore();
    }
  });

  it('keeps explicit passive: false separate from registrations that leave passive unset', () => {
    const addSpy = Sinon.spy(document, 'addEventListener');
    try {
      const stopExplicit = on('passive-unset:test', '.passive-unset', () => {}, { passive: false });
      const stopDefault = on('passive-unset:test', '.passive-unset', () => {});
      expect(addSpy.getCalls().filter((c) => c.args[0] === 'passive-unset:test').length).to.eq(2);
      stopExplicit();
      stopDefault();
    } finally {
      addSpy.restore();
    }
  });

  it('detaches from the signal once a once handler has fired', async () => {
    const root = await fixture<HTMLDivElement>(html`<div class="signal-once"></div>`);
    const controller = new AbortController();
    const removeSpy = Sinon.spy(controller.signal, 'removeEventListener');
    on('signal-once:test', '.signal-once', () => {}, { once: true, signal: controller.signal });

    root.dispatchEvent(new CustomEvent('signal-once:test', { bubbles: true }));
    expect(removeSpy.getCalls().filter((c) => c.args[0] === 'abort').length).to.eq(1);
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

  it('fires again when the same event object is re-dispatched after propagation was stopped', async () => {
    const callback = Sinon.spy((event: Event) => event.stopPropagation());
    const root = await fixture<HTMLDivElement>(html`<div class="redispatch"></div>`);
    const stop = on('redispatch:test', '.redispatch', callback);

    const event = new CustomEvent('redispatch:test', { bubbles: true });
    root.dispatchEvent(event);
    expect(callback.callCount).to.eq(1);
    root.dispatchEvent(event);
    expect(callback.callCount).to.eq(2);
    stop();
  });

  it('stopPropagation in one bucket blocks the other buckets of the same dispatch', async () => {
    const stopper = Sinon.spy((event: Event) => event.stopPropagation());
    const nonPassive = Sinon.spy();
    const root = await fixture<HTMLDivElement>(html`<div class="cross-bucket"></div>`);
    // Registered first, so its document listener runs first.
    const stopPassive = on('cross-bucket:test', '.cross-bucket', stopper, { passive: true });
    const stopNonPassive = on('cross-bucket:test', '.cross-bucket', nonPassive);

    try {
      const event = new CustomEvent('cross-bucket:test', { bubbles: true });
      root.dispatchEvent(event);
      expect(stopper.callCount).to.eq(1);
      expect(nonPassive.called).to.be.false;

      root.dispatchEvent(event);
      expect(stopper.callCount).to.eq(2);
      expect(nonPassive.called).to.be.false;
    } finally {
      stopPassive();
      stopNonPassive();
    }
  });

  it('still dispatches when a non-delegated document listener stopped propagation first', async () => {
    const foreign = Sinon.spy((event: Event) => event.stopPropagation());
    const callback = Sinon.spy();
    const root = await fixture<HTMLDivElement>(html`<div class="foreign-stop"></div>`);
    // Registered before `on()`, so the browser runs it first within the same phase on `document`.
    document.addEventListener('foreign-stop:test', foreign);
    const stop = on('foreign-stop:test', '.foreign-stop', callback);

    try {
      root.dispatchEvent(new CustomEvent('foreign-stop:test', { bubbles: true }));
      expect(foreign.callCount).to.eq(1);
      expect(callback.callCount).to.eq(1);
    } finally {
      stop();
      document.removeEventListener('foreign-stop:test', foreign);
    }
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
