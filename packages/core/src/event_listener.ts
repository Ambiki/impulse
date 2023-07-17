import type ImpulseElement from './element';

export default class EventListener implements EventListenerObject {
  constructor(
    private readonly instance: ImpulseElement,
    private readonly eventTarget: EventTarget,
    private eventName: string,
    private methodName: string
  ) {
    this.instance = instance;
    this.eventTarget = eventTarget;
    this.eventName = eventName;
    this.methodName = methodName;
  }

  start() {
    this.eventTarget.addEventListener(this.eventName, this);
  }

  stop() {
    this.eventTarget.removeEventListener(this.eventName, this);
  }

  handleEvent(event: Event) {
    const fn = (this.instance as unknown as Record<string, unknown>)[this.methodName];
    if (typeof fn === 'function') {
      fn.call(this.instance, event);
    }
  }
}
