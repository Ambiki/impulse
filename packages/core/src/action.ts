import type { ImpulseElement } from './element';
import type { Token, TokenListWatcherDelegate } from './observers/token_list_watcher';
import { parseActionDescriptor } from './action_descriptor';
import EventListener from './event_listener';
import { watchTokenList } from './observers/token_list_watcher';
import Scope from './scope';

const ATTRIBUTE_NAME = 'data-action';

export default class Action<T extends Element = Element> implements TokenListWatcherDelegate<T> {
  private stopWatching?: () => void;
  private scope: Scope;
  // Keyed by the `Token` object so `tokenUnmatched` only stops the listener that exact token created. The watcher
  // passes the same `Token` instance to both callbacks, and duplicate descriptors on one element get distinct tokens.
  private eventListenerMap = new Map<Token<T>, EventListener>();

  constructor(private readonly instance: ImpulseElement) {
    this.instance = instance;
    this.scope = new Scope(this.instance);
  }

  start() {
    if (!this.stopWatching) {
      this.stopWatching = watchTokenList<T>(this.instance, ATTRIBUTE_NAME, this);
    }
  }

  stop() {
    if (this.stopWatching) {
      this.stopWatching();
      this.stopWatching = undefined;
    }
  }

  tokenMatched(token: Token<T>) {
    const { content, element } = token;
    const { identifier, eventTarget, ...options } = parseActionDescriptor(content);
    if (options.eventName && identifier === this.identifier && options.methodName && this.scope.scopedTarget(element)) {
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
