import type { ActionDescriptor } from './action_descriptor';
import type { ImpulseElement } from './element';
import type { Token } from './observers/token_list_watcher';
import type { TokenRouterDelegate } from './observers/token_router';
import { parseActionDescriptor } from './action_descriptor';
import EventListener from './event_listener';
import TokenRouter from './observers/token_router';

// One document-wide `[data-action]` watcher for every instance; tokens are routed to the instance named by the
// descriptor's identifier.
const router = new TokenRouter('data-action', parseActionDescriptor);

export default class Action<T extends Element = Element> implements TokenRouterDelegate<T, ActionDescriptor> {
  private stopWatching?: () => void;
  // Keyed by the `Token` object so `tokenUnmatched` only stops the listener that exact token created. The watcher
  // passes the same `Token` instance to both callbacks, and duplicate descriptors on one element get distinct tokens.
  private eventListenerMap = new Map<Token<T>, EventListener>();

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
    const { eventName, eventModifiers, eventListenerOptions, eventTarget, methodName } = descriptor;
    if (!eventName || !methodName) return;
    const eventListener = new EventListener(this.instance, {
      eventName,
      eventModifiers,
      eventListenerOptions,
      eventTarget: eventTarget || token.element,
      methodName,
    });
    this.eventListenerMap.set(token, eventListener);
    eventListener.start();
  }

  tokenUnmatched(token: Token<T>) {
    const eventListener = this.eventListenerMap.get(token);
    if (!eventListener) return;

    eventListener.stop();
    this.eventListenerMap.delete(token);
  }
}
