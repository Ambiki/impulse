import type { ImpulseElement } from './element';
import type { Token, TokenListWatcherDelegate } from './observers/token_list_watcher';
import { parseActionDescriptor } from './action_descriptor';
import EventListener from './event_listener';
import TokenRouter from './observers/token_router';

// One document-wide `[data-action]` watcher for every instance; tokens are routed to the instance named by the
// descriptor's identifier.
const router = new TokenRouter('data-action', (content) => parseActionDescriptor(content).identifier);

export default class Action<T extends Element = Element> implements TokenListWatcherDelegate<T> {
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

  tokenMatched(token: Token<T>) {
    const { content, element } = token;
    const { identifier, eventTarget, ...options } = parseActionDescriptor(content);
    // The router only delivers tokens whose closest `identifier` ancestor is this instance, so no scope check is
    // needed here. The identifier comparison still rejects tokens routed here by a selector other than this tag name;
    // it parses the content with the same `parseActionDescriptor` the router's `identifierFor` uses.
    if (options.eventName && identifier === this.identifier && options.methodName) {
      const eventListener = new EventListener(this.instance, { ...options, eventTarget: eventTarget || element });
      this.eventListenerMap.set(token, eventListener);
      eventListener.start();
    }
  }

  tokenUnmatched(token: Token<T>) {
    const eventListener = this.eventListenerMap.get(token);
    if (!eventListener) return;

    eventListener.stop();
    this.eventListenerMap.delete(token);
  }

  private get identifier() {
    return this.instance.identifier;
  }
}
