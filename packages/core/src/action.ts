import { parseActionDescriptor } from './action_descriptor';
import SetMap from './data_structures/set_map';
import type ImpulseElement from './element';
import EventListener from './event_listener';
import { getAttributeValues } from './helpers/dom';
import AttributeObserver from './observers/attribute_observer';

const ATTRIBUTE_NAME = 'data-action';

export default class Action {
  private attributeObserver: AttributeObserver;
  private eventListenerMap = new SetMap<Element, EventListener>();

  constructor(private readonly instance: ImpulseElement) {
    this.instance = instance;
    this.attributeObserver = new AttributeObserver(this.instance, ATTRIBUTE_NAME, this);
  }

  start() {
    this.attributeObserver.start();
    const elements = Array.from(this.instance.querySelectorAll(`[${ATTRIBUTE_NAME}]`));
    // Bind event for the element itself.
    if (this.instance.hasAttribute(ATTRIBUTE_NAME)) elements.push(this.instance);
    elements.forEach((element) => this.bindActions(element));
  }

  stop() {
    this.eventListenerMap.values.forEach((eventListener) => eventListener.stop());
    this.eventListenerMap.clear();
    this.attributeObserver.stop();
  }

  elementConnected(element: Element) {
    this.bindActions(element);
  }

  elementDisconnected(element: Element) {
    this.unbindActions(element);
  }

  elementAttributeChanged(element: Element) {
    this.unbindActions(element);
    this.bindActions(element);
  }

  private bindActions(element: Element) {
    const descriptors = getAttributeValues(element, ATTRIBUTE_NAME);
    descriptors.forEach((descriptor) => {
      const { eventName, eventTarget, methodName, identifier } = parseActionDescriptor(descriptor);
      if (!eventName || identifier !== this.identifier || !methodName) return;
      const eventListener = new EventListener(this.instance, eventTarget || element, eventName, methodName);
      this.eventListenerMap.add(element, eventListener);
      eventListener.start();
    });
  }

  private unbindActions(element: Element) {
    const eventListeners = this.eventListenerMap.get(element);
    if (!eventListeners) return;
    eventListeners.forEach((eventListener) => {
      eventListener.stop();
      this.eventListenerMap.delete(element, eventListener);
    });
  }

  private get identifier() {
    return this.instance.identifier;
  }
}
