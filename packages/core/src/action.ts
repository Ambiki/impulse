import type { ImpulseElement } from './element';
import type { Token, TokenListWatcherDelegate } from './observers/token_list_watcher';
import { parseActionDescriptor } from './action_descriptor';
import SetMap from './data_structures/set_map';
import EventListener from './event_listener';
import { watchTokenList } from './observers/token_list_watcher';
import Scope from './scope';

const ATTRIBUTE_NAME = 'data-action';

export default class Action<T extends Element = Element> implements TokenListWatcherDelegate<T> {
  private stopWatching?: () => void;
  private scope: Scope;
  private eventListenerMap = new SetMap<T, EventListener>();

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

  tokenMatched({ content, element }: Token<T>) {
    const { identifier, eventTarget, ...options } = parseActionDescriptor(content);
    if (options.eventName && identifier === this.identifier && options.methodName && this.scope.scopedTarget(element)) {
      const eventListener = new EventListener(this.instance, { ...options, eventTarget: eventTarget || element });
      this.eventListenerMap.add(element, eventListener);
      eventListener.start();
    }
  }

  tokenUnmatched({ element }: Token<T>) {
    const eventListeners = this.eventListenerMap.get(element);
    if (!eventListeners) return;

    for (const eventListener of eventListeners) {
      eventListener.stop();
      this.eventListenerMap.delete(element, eventListener);
    }
  }

  private get identifier() {
    return this.instance.identifier;
  }
}
