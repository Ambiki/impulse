import { parseActionDescriptor } from './action_descriptor';
import SetMap from './data_structures/set_map';
import type ImpulseElement from './element';
import EventListener from './event_listener';
import { getAttributeValues } from './helpers/dom';
import AttributeObserver from './observers/attribute_observer';
import Scope from './scope';

const ATTRIBUTE_NAME = 'data-action';

export default class Action {
  private attributeObserver: AttributeObserver;
  private scope: Scope;
  private eventListenerMap = new SetMap<Element, EventListener>();

  constructor(private readonly instance: ImpulseElement) {
    this.instance = instance;
    this.scope = new Scope(this.instance);
    this.attributeObserver = new AttributeObserver(this.instance, ATTRIBUTE_NAME, this);
  }

  start() {
    this.attributeObserver.start();
    this.actionableElements.forEach((element) => this.bindActions(element));
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
      const { eventName, eventModifiers, eventListenerOptions, eventTarget, methodName, identifier } =
        parseActionDescriptor(descriptor);
      if (eventName && identifier === this.identifier && methodName && this.actionableElements.includes(element)) {
        const eventListener = new EventListener(
          this.instance,
          eventTarget || element,
          eventName,
          eventModifiers,
          eventListenerOptions,
          methodName
        );
        this.eventListenerMap.add(element, eventListener);
        eventListener.start();
      }
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

  private get actionableElements() {
    return this.scope.findTargets(`[${ATTRIBUTE_NAME}]`);
  }

  private get identifier() {
    return this.instance.identifier;
  }
}
