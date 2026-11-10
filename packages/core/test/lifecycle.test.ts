import { expect, nextFrame, waitUntil } from '@open-wc/testing';
import { ImpulseElement, isInitialized, registerElement, target, targets, whenInitialized } from '../src';

let counter = 0;

describe('whenInitialized', () => {
  const CONNECTION_TIMEOUT_MS = 200;

  /** Waits for `element` to advertise that it has initialized, so a test can start from a known state. */
  function waitForMarker(element: Element) {
    return waitUntil(() => element.hasAttribute('data-impulse-element'), 'element should initialize', {
      timeout: CONNECTION_TIMEOUT_MS,
    });
  }

  /** Asserts that `promise` is still waiting once a beat has passed, rather than having resolved or rejected. */
  async function expectPending(promise: Promise<unknown>) {
    const outcome = await Promise.race([
      promise.then(() => 'settled', () => 'settled'),
      new Promise((resolve) => setTimeout(resolve, 50, 'pending')),
    ]);
    expect(outcome).to.eq('pending');
  }

  it('resolves with the element when it is already initialized', async () => {
    counter += 1;
    const tag = `when-initialized-${counter}`;
    class WhenInitializedElement extends ImpulseElement {}
    registerElement(tag)(WhenInitializedElement);

    const element = document.createElement(tag) as WhenInitializedElement;
    document.body.appendChild(element);

    try {
      await waitForMarker(element);
      const resolved = await whenInitialized(element);
      expect(resolved).to.eq(element);
    } finally {
      element.remove();
    }
  });

  it('resolves once the element becomes initialized', async () => {
    counter += 1;
    const tag = `when-initialized-${counter}`;
    class WhenInitializedElement extends ImpulseElement {}
    registerElement(tag)(WhenInitializedElement);

    const element = document.createElement(tag) as WhenInitializedElement;
    document.body.appendChild(element);

    try {
      // Called before `_asyncConnect` has set the marker attribute.
      expect(element.hasAttribute('data-impulse-element')).to.be.false;
      const resolved = await whenInitialized(element);
      expect(resolved).to.eq(element);
      expect(element.hasAttribute('data-impulse-element')).to.be.true;
    } finally {
      element.remove();
    }
  });

  it('resolves when the element class is registered after the call', async () => {
    counter += 1;
    const tag = `when-initialized-${counter}`;
    class WhenInitializedElement extends ImpulseElement {}

    // Create and attach the element before its class is defined.
    const element = document.createElement(tag) as WhenInitializedElement;
    document.body.appendChild(element);

    try {
      const promise = whenInitialized(element);
      registerElement(tag)(WhenInitializedElement);
      const resolved = await promise;
      expect(resolved).to.eq(element);
      expect(element.hasAttribute('data-impulse-element')).to.be.true;
    } finally {
      element.remove();
    }
  });

  it('resolves immediately for a standard HTML element', async () => {
    const element = document.createElement('div');
    expect(element.hasAttribute('data-impulse-element')).to.be.false;
    const resolved = await whenInitialized(element);
    expect(resolved).to.eq(element);
  });

  it('resolves once a non-Impulse custom element is defined', async () => {
    counter += 1;
    const tag = `non-impulse-${counter}`;
    // A plain custom element that is not an ImpulseElement, so it never receives the marker attribute.
    class Plain extends HTMLElement {}
    customElements.define(tag, Plain);

    const element = document.createElement(tag);
    document.body.appendChild(element);

    try {
      const resolved = await whenInitialized(element, { timeout: CONNECTION_TIMEOUT_MS });
      expect(resolved).to.eq(element);
      expect(element.hasAttribute('data-impulse-element')).to.be.false;
    } finally {
      element.remove();
    }
  });

  it('resolves once a non-Impulse custom element is defined after the call', async () => {
    counter += 1;
    const tag = `non-impulse-late-${counter}`;
    class Plain extends HTMLElement {}

    const element = document.createElement(tag);
    document.body.appendChild(element);

    try {
      const promise = whenInitialized(element, { timeout: CONNECTION_TIMEOUT_MS });
      customElements.define(tag, Plain);
      const resolved = await promise;
      expect(resolved).to.eq(element);
    } finally {
      element.remove();
    }
  });

  it('waits indefinitely by default and resolves once the element initializes', async () => {
    counter += 1;
    const tag = `no-timeout-${counter}`;
    class WhenInitializedElement extends ImpulseElement {}

    const element = document.createElement(tag) as WhenInitializedElement;
    document.body.appendChild(element);

    try {
      const promise = whenInitialized(element);

      // With no deadline the promise stays pending while the tag is unregistered - it does not reject.
      await expectPending(promise);

      // Once the class is registered it resolves.
      registerElement(tag)(WhenInitializedElement);
      const resolved = await promise;
      expect(resolved).to.eq(element);
    } finally {
      element.remove();
    }
  });

  it('rejects after an explicit timeout when the element never initializes', async () => {
    counter += 1;
    // A hyphenated tag that is never registered, so it never initializes.
    const tag = `never-impulse-${counter}`;
    const element = document.createElement(tag);
    document.body.appendChild(element);

    let error: unknown;
    try {
      await whenInitialized(element, { timeout: 50 });
    } catch (err) {
      error = err;
    } finally {
      element.remove();
    }

    expect(error).to.be.an.instanceOf(Error);
  });

  it('resolves when the element is removed in the same task it initializes', async () => {
    counter += 1;
    const tag = `same-task-removal-${counter}`;
    class WhenInitializedElement extends ImpulseElement {
      connected() {
        // Initializing and disconnecting within one task must still resolve whoever was waiting on this element.
        this.remove();
      }
    }
    registerElement(tag)(WhenInitializedElement);

    const element = document.createElement(tag) as WhenInitializedElement;
    document.body.appendChild(element);

    const resolved = await whenInitialized(element, { timeout: CONNECTION_TIMEOUT_MS });
    expect(resolved).to.eq(element);
    expect(element.isConnected).to.be.false;
  });

  it('stays pending while the marker attribute is stale', async () => {
    counter += 1;
    const tag = `stale-marker-${counter}`;
    class WhenInitializedElement extends ImpulseElement {
      initialized = false;

      connected() {
        this.initialized = true;
      }
    }
    registerElement(tag)(WhenInitializedElement);

    const element = document.createElement(tag) as WhenInitializedElement;
    document.body.appendChild(element);

    try {
      await waitForMarker(element);

      // A copy carries the marker attribute over, but has initialized nothing.
      const clone = element.cloneNode(true) as WhenInitializedElement;
      expect(clone.hasAttribute('data-impulse-element')).to.be.true;
      const promise = whenInitialized(clone);

      await expectPending(promise);

      document.body.appendChild(clone);
      try {
        const resolved = await promise;
        expect(resolved).to.eq(clone);
        expect(resolved.initialized).to.be.true;
      } finally {
        clone.remove();
      }
    } finally {
      element.remove();
    }
  });

  it('stays pending for a disconnected element until it is connected again', async () => {
    counter += 1;
    const tag = `reconnected-${counter}`;
    class WhenInitializedElement extends ImpulseElement {}
    registerElement(tag)(WhenInitializedElement);

    const element = document.createElement(tag) as WhenInitializedElement;
    document.body.appendChild(element);

    try {
      await waitForMarker(element);
      element.remove();

      const promise = whenInitialized(element);
      await expectPending(promise);

      document.body.appendChild(element);
      const resolved = await promise;
      expect(resolved).to.eq(element);
    } finally {
      element.remove();
    }
  });
});

describe('isInitialized', () => {
  it('is false while the element waits to initialize, and true once it has', async () => {
    counter += 1;
    const tag = `is-initialized-${counter}`;
    const childTag = `is-initialized-child-${counter}`;
    class IsInitializedElement extends ImpulseElement {
      static migratedToWhenInitialized = true;
    }
    registerElement(tag)(IsInitializedElement);

    // An undefined custom element inside holds the init back until it is defined. That is the deprecated implicit wait,
    // and the flag only silences its warning. Once that wait is removed, hold the init some other way.
    const element = document.createElement(tag);
    element.appendChild(document.createElement(childTag));
    document.body.appendChild(element);

    try {
      await nextFrame();
      expect(element.isConnected).to.be.true;
      expect(isInitialized(element)).to.be.false;

      customElements.define(childTag, class extends HTMLElement {});
      await whenInitialized(element);
      expect(isInitialized(element)).to.be.true;
    } finally {
      element.remove();
    }
  });

  it('is true inside connected()', async () => {
    counter += 1;
    const tag = `is-initialized-${counter}`;
    let seen: boolean | undefined;
    class IsInitializedElement extends ImpulseElement {
      connected() {
        seen = isInitialized(this);
      }
    }
    registerElement(tag)(IsInitializedElement);

    const element = document.createElement(tag);
    document.body.appendChild(element);

    try {
      await whenInitialized(element);
      expect(seen).to.be.true;
    } finally {
      element.remove();
    }
  });

  it('is false inside [target]Connected() during init, and true for a target added after it', async () => {
    counter += 1;
    const tag = `is-initialized-${counter}`;
    const seen: boolean[] = [];
    class IsInitializedElement extends ImpulseElement {
      @targets() items!: HTMLElement[];

      itemsConnected() {
        seen.push(isInitialized(this));
      }
    }
    registerElement(tag)(IsInitializedElement);

    const element = document.createElement(tag);
    element.innerHTML = `<span data-target="${tag}.items"></span>`;
    document.body.appendChild(element);

    try {
      await whenInitialized(element);
      expect(seen).to.deep.eq([false]);

      const later = document.createElement('span');
      later.setAttribute('data-target', `${tag}.items`);
      element.appendChild(later);
      await waitUntil(() => seen.length === 2, 'the later target should connect');
      expect(seen).to.deep.eq([false, true]);
    } finally {
      element.remove();
    }
  });

  it('is false inside disconnected() and [target]Disconnected()', async () => {
    counter += 1;
    const tag = `is-initialized-${counter}`;
    const seen: Record<string, boolean> = {};
    class IsInitializedElement extends ImpulseElement {
      @target() panel!: HTMLElement;

      disconnected() {
        seen.disconnected = isInitialized(this);
      }

      panelDisconnected() {
        seen.panelDisconnected = isInitialized(this);
      }
    }
    registerElement(tag)(IsInitializedElement);

    const element = document.createElement(tag);
    element.innerHTML = `<div data-target="${tag}.panel"></div>`;
    document.body.appendChild(element);

    try {
      await whenInitialized(element);
      element.remove();
      expect(seen).to.deep.eq({ disconnected: false, panelDisconnected: false });
    } finally {
      element.remove();
    }
  });

  it('is false once the element is removed, and true again once it re-initializes', async () => {
    counter += 1;
    const tag = `is-initialized-${counter}`;
    class IsInitializedElement extends ImpulseElement {}
    registerElement(tag)(IsInitializedElement);

    const element = document.createElement(tag);
    document.body.appendChild(element);

    try {
      await whenInitialized(element);
      element.remove();
      expect(isInitialized(element)).to.be.false;

      document.body.appendChild(element);
      expect(isInitialized(element)).to.be.false;
      await whenInitialized(element);
      expect(isInitialized(element)).to.be.true;
    } finally {
      element.remove();
    }
  });

  it('is false for a copy carrying the marker attribute until the copy initializes', async () => {
    counter += 1;
    const tag = `is-initialized-${counter}`;
    class IsInitializedElement extends ImpulseElement {}
    registerElement(tag)(IsInitializedElement);

    const element = document.createElement(tag);
    document.body.appendChild(element);
    let copy: Element | undefined;

    try {
      await whenInitialized(element);
      copy = element.cloneNode(true) as Element;
      expect(copy.hasAttribute('data-impulse-element')).to.be.true;
      expect(isInitialized(copy)).to.be.false;

      document.body.appendChild(copy);
      expect(isInitialized(copy)).to.be.false;
      await whenInitialized(copy);
      expect(isInitialized(copy)).to.be.true;
    } finally {
      element.remove();
      copy?.remove();
    }
  });

  it('is false for elements that never initialize', async () => {
    counter += 1;
    const tag = `non-impulse-${counter}`;
    customElements.define(tag, class extends HTMLElement {});

    const div = document.createElement('div');
    const plain = document.createElement(tag);
    document.body.append(div, plain);

    try {
      await whenInitialized(div);
      await whenInitialized(plain);
      expect(isInitialized(div)).to.be.false;
      expect(isInitialized(plain)).to.be.false;
    } finally {
      div.remove();
      plain.remove();
    }
  });
});
