import type { ActionDescriptor } from './action_descriptor';
import type { ImpulseElement } from './element';
import type { Token } from './observers/token_list_watcher';
import type { TokenRouterDelegate } from './observers/token_router';
import { modifierGuards, parseActionDescriptor } from './action_descriptor';
import TokenRouter from './observers/token_router';

// One document-wide `[data-action]` watcher for every instance; tokens are routed to the instance named by the
// descriptor's identifier.
const router = new TokenRouter('data-action', parseActionDescriptor);

// The listener a `data-action` token added, with the event target, event name and options it was added with.
interface BoundListener {
  eventTarget: EventTarget;
  eventName: string;
  options: EventListenerOptions;
  listener: (event: Event) => void;
}

export default class Action<T extends Element = Element> implements TokenRouterDelegate<T, ActionDescriptor> {
  private stopWatching?: () => void;
  // Keyed by the `Token` object so `tokenUnmatched` only removes the listener that exact token added. The watcher
  // passes the same `Token` instance to both callbacks, and duplicate descriptors on one element get distinct tokens,
  // each with a listener of its own.
  private listeners = new Map<Token<T>, BoundListener>();

  constructor(private readonly instance: ImpulseElement) {}

  start() {
    if (!this.stopWatching) {
      this.stopWatching = router.subscribe(this.instance, this);
    }
  }

  stop() {
    const stopWatching = this.stopWatching;
    if (!stopWatching) return;
    // Reset first so a throwing stop cannot block `start()` from creating a fresh watcher on reconnect.
    this.stopWatching = undefined;
    stopWatching();
  }

  tokenMatched(token: Token<T>, descriptor: ActionDescriptor) {
    // The router only delivers tokens whose identifier is this element's tag name, so only the event and method are
    // left to check.
    const { eventName, eventModifiers, eventListenerOptions, methodName } = descriptor;
    if (!eventName || !methodName) return;
    // `window` or `document` when the descriptor names one, and otherwise the element carrying the token.
    const eventTarget = descriptor.eventTarget || token.element;
    const listener = (event: Event) => this.invoke(methodName, eventModifiers, event);
    this.listeners.set(token, { eventTarget, eventName, options: eventListenerOptions, listener });
    eventTarget.addEventListener(eventName, listener, eventListenerOptions);
  }

  tokenUnmatched(token: Token<T>) {
    const bound = this.listeners.get(token);
    if (!bound) return;

    bound.eventTarget.removeEventListener(bound.eventName, bound.listener, bound.options);
    this.listeners.delete(token);
  }

  // Calls the element's `methodName` with `event`, unless one of the token's modifiers holds it back. The method is
  // looked up as the event arrives, so one defined or replaced after the action was bound is the one called, and with
  // no such method no modifier is applied.
  private invoke(methodName: string, modifiers: readonly string[], event: Event) {
    const fn = (this.instance as unknown as Record<string, unknown>)[methodName];
    if (typeof fn !== 'function') return;

    for (const modifier of modifiers) {
      if (modifierGuards[modifier]?.(event)) return;
    }

    fn.call(this.instance, event);
  }
}
