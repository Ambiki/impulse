import { modifierGuards } from './action_descriptor';
import type ImpulseElement from './element';

type Options = {
  eventListenerOptions: EventListenerOptions;
  eventModifiers: string[];
  eventName: string;
  eventTarget: EventTarget;
  methodName: string;
};

export default class EventListener implements EventListenerObject {
  private readonly instance: ImpulseElement;
  private eventListenerOptions: EventListenerOptions;
  private eventModifiers: string[];
  private eventName: string;
  private eventTarget: EventTarget;
  private methodName: string;

  constructor(instance: ImpulseElement, options: Options) {
    this.instance = instance;
    this.eventTarget = options.eventTarget;
    this.eventName = options.eventName;
    this.eventModifiers = options.eventModifiers;
    this.eventListenerOptions = options.eventListenerOptions;
    this.methodName = options.methodName;
  }

  start() {
    this.eventTarget.addEventListener(this.eventName, this, this.eventListenerOptions);
  }

  stop() {
    this.eventTarget.removeEventListener(this.eventName, this, this.eventListenerOptions);
  }

  handleEvent(event: Event) {
    const fn = (this.instance as unknown as Record<string, unknown>)[this.methodName];
    if (typeof fn !== 'function') return;

    for (const modifier of this.eventModifiers) {
      const guard = modifierGuards[modifier];
      if (guard?.(event)) return;
    }

    fn.call(this.instance, event);
  }
}
