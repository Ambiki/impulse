import { modifierGuards } from './action_descriptor';
import type ImpulseElement from './element';

export default class EventListener implements EventListenerObject {
  constructor(
    private readonly instance: ImpulseElement,
    private readonly eventTarget: EventTarget,
    private eventName: string,
    private eventModifiers: string[],
    private eventListenerOptions: EventListenerOptions,
    private methodName: string
  ) {
    this.instance = instance;
    this.eventTarget = eventTarget;
    this.eventName = eventName;
    this.eventModifiers = eventModifiers;
    this.eventListenerOptions = eventListenerOptions;
    this.methodName = methodName;
  }

  start() {
    this.eventTarget.addEventListener(this.eventName, this, this.eventListenerOptions);
  }

  stop() {
    this.eventTarget.removeEventListener(this.eventName, this, this.eventListenerOptions);
  }

  handleEvent(event: Event) {
    const fn = (this.instance as unknown as Record<string, unknown>)[this.methodName];
    if (typeof fn === 'function') {
      for (const modifier of this.eventModifiers) {
        const guard = modifierGuards[modifier];
        if (guard?.(event)) return;
      }

      fn.call(this.instance, event);
    }
  }
}
