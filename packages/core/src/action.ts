import { parseActionDescriptor } from './action_descriptor';
import SetMap from './data_structures/set_map';
import type ImpulseElement from './element';
import EventListener from './event_listener';
import { Token, TokenListObserver, TokenListObserverDelegate } from './observers/token_list_observer';
import Scope from './scope';

const ATTRIBUTE_NAME = 'data-action';

export default class Action implements TokenListObserverDelegate {
  private tokenListObserver?: TokenListObserver;
  private scope: Scope;
  private eventListenerMap = new SetMap<Element, EventListener>();

  constructor(private readonly instance: ImpulseElement) {
    this.instance = instance;
    this.scope = new Scope(this.instance);
  }

  start() {
    if (!this.tokenListObserver) {
      this.tokenListObserver = new TokenListObserver(this.instance, ATTRIBUTE_NAME, this);
      this.tokenListObserver.start();
    }
  }

  stop() {
    if (this.tokenListObserver) {
      this.destroyActions();
      this.tokenListObserver.stop();
      this.tokenListObserver = undefined;
    }
  }

  tokenMatched({ content, element }: Token) {
    const { identifier, eventTarget, ...options } = parseActionDescriptor(content);
    if (options.eventName && identifier === this.identifier && options.methodName && this.scope.scopedTarget(element)) {
      const eventListener = new EventListener(this.instance, { ...options, eventTarget: eventTarget || element });
      this.eventListenerMap.add(element, eventListener);
      eventListener.start();
    }
  }

  tokenUnmatched({ element }: Token) {
    const eventListeners = this.eventListenerMap.get(element);
    if (!eventListeners) return;

    for (const eventListener of eventListeners) {
      eventListener.stop();
      this.eventListenerMap.delete(element, eventListener);
    }
  }

  private destroyActions() {
    for (const target of this.eventListenerMap.keys) {
      this.tokenListObserver?.elementDisconnected(target);
    }
  }

  private get identifier() {
    return this.instance.identifier;
  }
}
