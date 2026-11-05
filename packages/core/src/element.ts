import Action from './action';
import { IMPULSE_ELEMENT_ATTRIBUTE } from './constants';
import { emit } from './events';
import { whenParsed } from './helpers/dom';
import { invokeEach } from './helpers/invoke_each';
import { camelize, dasherize } from './helpers/string';
import { clearInitialized, notifyInitialized } from './initialization';
import Property from './property';
import { PROPERTIES, registered } from './registry';
import Target from './target';

interface TearingDown {
  readonly phase: 'tearingDown';
  reconnected: boolean;
}

/**
 * Where an element is in its lifecycle:
 *
 * - `idle`: nothing is running. A connect starts an init.
 * - `initializing`: `_asyncConnect` is starting properties, targets and actions. It re-checks `isConnected` after each
 *   await and each start step, so connects and disconnects are left to it.
 * - `initialized`: the element is Initialized. A disconnect starts a teardown.
 * - `tearingDown`: `disconnectedCallback` is running its steps, which can reconnect the element or remove it again. A
 *   reconnect is only recorded, and acted on once the steps have finished.
 */
type Lifecycle =
  { readonly phase: 'idle' } |
  { readonly phase: 'initializing' } |
  { readonly phase: 'initialized' } |
  TearingDown;

const IDLE: Lifecycle = { phase: 'idle' };
const INITIALIZED: Lifecycle = { phase: 'initialized' };

export class ImpulseElement extends HTMLElement {
  /**
   * Set to `true` once you have migrated target connected callbacks to `whenInitialized()` to silence the deprecation
   * warning about the implicit descendant-definition wait. Set it on `ImpulseElement` to opt out globally, or on a
   * specific element class to opt out per class.
   */
  static migratedToWhenInitialized = false;

  private property = new Property(this);
  private target = new Target(this);
  private action = new Action(this);
  private _lifecycle: Lifecycle = IDLE;

  connectedCallback() {
    const lifecycle = this._lifecycle;
    // A reconnect during teardown is only recorded: the teardown starts the fresh init once it has finished.
    if (lifecycle.phase === 'tearingDown') {
      lifecycle.reconnected = true;
      return;
    }
    // Only an idle element starts an init. A reconnect while one is still initializing must not start a second; the
    // pending init finishes on its own.
    if (lifecycle.phase === 'idle') this._asyncConnect();
  }

  static get observedAttributes(): string[] {
    return Array.from(registered(this.prototype, PROPERTIES).keys(), dasherize);
  }

  attributeChangedCallback(name: string, _oldValue: string | null, _newValue: string | null) {
    // Changes are reported from the moment the element is Initialized until its teardown has finished, so a
    // `disconnected()` that sets a property is still told about it.
    const { phase } = this._lifecycle;
    if ((phase !== 'initialized' && phase !== 'tearingDown') || _oldValue === _newValue) return;

    const camelizedName = camelize(name);
    const fn = (this as Record<string, unknown>)[`${camelizedName}Changed`];
    if (typeof fn !== 'function') return;

    const change = this.property.change(camelizedName, _oldValue, _newValue);
    if (change) fn.call(this, change.newValue, change.oldValue);
  }

  disconnectedCallback() {
    // Only an Initialized element is torn down. An init still running re-checks `isConnected` itself, and a removal
    // during teardown, after a step reconnected the element, must not run the steps a second time.
    if (this._lifecycle.phase !== 'initialized') return;
    const teardown: TearingDown = { phase: 'tearingDown', reconnected: false };
    this._lifecycle = teardown;
    // The element stops being Initialized as the teardown begins, so a `whenInitialized()` call made by one of the
    // steps waits for the next init rather than resolving with an element that is being torn down.
    this.removeAttribute(IMPULSE_ELEMENT_ATTRIBUTE);
    clearInitialized(this);

    // Order is important. Every step runs even if an earlier one throws, so a throwing `disconnected()` cannot leave
    // the watchers registered or the element unable to re-initialize; the first error is rethrown once the element is
    // fully torn down.
    const steps = [
      () => this.disconnected(),
      () => this.action.stop(),
      () => this.target.stop(),
      () => this.property.stop(),
    ];
    try {
      invokeEach(steps, (step) => step());
    } finally {
      this._lifecycle = IDLE;
      // `connectedCallback` ran during the steps and only recorded the reconnect, so the fresh init starts here unless
      // the element was removed again since. That is either a step (`disconnected()`, a `[target]Disconnected`)
      // reconnecting the element, or the reconnect of the move that started this teardown: a step that queues another
      // reaction on the element makes Chromium and Firefox run the move's `connectedCallback` inside the teardown.
      // Otherwise a move reaches `connectedCallback` once this returns, and initializes there.
      if (teardown.reconnected && this.isConnected) this._asyncConnect();
    }
  }

  connected() {
    // Override in your subclass to respond when the element is connected to the DOM.
  }

  disconnected() {
    // Override in your subclass to respond when the element is removed from the DOM.
  }

  /**
   * Emits a custom event from the element, prefixed with the element's identifier so listeners can tell one element's
   * events from another's: `this.emit('copied')` on a `<clip-board>` dispatches `clip-board:copied`.
   *
   * Takes the same options as the standalone {@link emit}, plus `prefix` (a different prefix, or `false` for the bare
   * event name) and `target` (what to dispatch from, defaulting to the element).
   */
  emit<T extends Record<string, any>>(
    name: string,
    {
      target = this,
      prefix = this.identifier,
      ...rest
    }: CustomEventInit<T> & { target?: Element | Window | Document; prefix?: boolean | string } = {},
  ): CustomEvent<T> {
    const eventName = prefix ? `${prefix}:${name}` : name;
    return emit(target, eventName, rest);
  }

  get identifier() {
    return this.tagName.toLowerCase();
  }

  private async _asyncConnect() {
    // The `initializing` state is replaced inside this method (by `initialized` before `connected()`, and by `idle` in
    // the `finally` on every other exit) rather than from a `.finally()` on its promise so it changes synchronously; a
    // reconnect in the next microtask must find the element idle and start a fresh init. Each call gets its own state
    // object and resets only that one: a move inside `connected()` starts a new init that is still initializing when
    // this one returns, and resetting that one would let a further reconnect start a second init alongside it.
    const initializing: Lifecycle = { phase: 'initializing' };
    this._lifecycle = initializing;
    try {
      // Define property accessors synchronously, before yielding to `whenParsed`, so a defined element's properties are
      // live as soon as it connects. Property setup only reads the element's own attributes/defaults, so it does not
      // need to wait for the document or for descendants (unlike `target`/`action`, which scan children).
      this.property.start();
      await whenParsed();
      // Removed while waiting: no watcher has been registered yet, so there is nothing to tear down and a later
      // reconnect starts over. The same applies after the second await below.
      if (!this.isConnected) return;
      customElements.upgrade(this);
      // Resolve all undefined elements before initializing the target/targets so that property references can be
      // resolved to the assigned value.
      // DEPRECATED: this implicit wait will be removed in the next major version. Use `whenInitialized()` inside
      // connected callbacks instead. See `_resolveUndefinedElements`.
      await this._resolveUndefinedElements();
      // Removed while waiting for descendants to be defined.
      if (!this.isConnected) return;
      // Order is important: targets must be wired up before actions. Each start runs code synchronously: replaying the
      // existing targets invokes `[target]Connected`, and subscribing flushes pending mutations, which runs other
      // elements' callbacks. Any of it can remove the element, and `disconnectedCallback` ignores a removal until the
      // element is Initialized, so the check is repeated after each.
      this.target.start();
      if (!this.isConnected) {
        this._abandonInit();
        return;
      }
      this.action.start();
      if (!this.isConnected) {
        this._abandonInit();
        return;
      }
      // Initialized once targets and actions have started, so a move inside `connected()` below takes the normal
      // disconnect and reconnect path: `disconnected()`, then a fresh init at the new position. Still initializing, the
      // reconnect would be dropped and the element left in the DOM torn down.
      this._lifecycle = INITIALIZED;

      this.setAttribute(IMPULSE_ELEMENT_ATTRIBUTE, '');
      // Before `connected()`, so the marker being set and the waiters being resolved are one step: a `connected()`
      // that throws, or that removes the element, cannot leave a `whenInitialized()` call waiting forever.
      notifyInitialized(this);
      this.connected();
    } finally {
      if (this._lifecycle === initializing) this._lifecycle = IDLE;
    }
  }

  /**
   * Stops whatever an init started before the element was removed, so a later reconnect starts over. Stopping targets
   * invokes `[target]Disconnected` for the ones just connected, keeping the callbacks paired. That code can reconnect
   * the element, so it must be idle by then: the reconnect starts a fresh init rather than being dropped.
   */
  private _abandonInit() {
    this._lifecycle = IDLE;
    invokeEach([() => this.action.stop(), () => this.target.stop()], (step) => step());
  }

  private _resolveUndefinedElements() {
    const undefinedElements = Array.from(this.querySelectorAll(':not(:defined)'));
    const migrated = (this.constructor as typeof ImpulseElement).migratedToWhenInitialized;
    if (undefinedElements.length > 0 && !migrated) {
      console.warn(
        `[impulse] <${this.identifier}> waits for descendant custom elements to be defined before invoking target ` +
        `connected callbacks. This is deprecated and will be removed in the next major version. If a connected ` +
        `callback reads properties on a target element, await whenInitialized(target) inside the callback instead. ` +
        `Set ImpulseElement.migratedToWhenInitialized = true to silence this warning.`,
      );
    }
    const promises = undefinedElements.map((element) => customElements.whenDefined(element.localName));
    return Promise.all(promises);
  }
}
