import ElementObserver from './element_observer';

type AttributeObserverDelegate = {
  elementConnected: (target: Element) => void;
  elementDisconnected: (target: Element) => void;
  elementAttributeChanged?: (target: Element, name: string) => void;
};

export default class AttributeObserver {
  private elementObserver: ElementObserver;

  constructor(
    private readonly instance: HTMLElement,
    private readonly attributeName: string,
    private delegate: AttributeObserverDelegate
  ) {
    this.instance = instance;
    this.attributeName = attributeName;
    this.elementObserver = new ElementObserver(this.instance, this, { attributeFilter: [this.attributeName] });
    this.delegate = delegate;
  }

  start() {
    this.elementObserver.start();
  }

  stop() {
    this.elementObserver.stop();
  }

  elementConnected(target: Element) {
    const elements = Array.from(target.querySelectorAll<Element>(`[${this.attributeName}]`));
    if (target.hasAttribute(this.attributeName)) elements.push(target);

    for (const element of elements) {
      this.delegate.elementConnected(element);
    }
  }

  elementDisconnected(target: Element) {
    const elements = Array.from(target.querySelectorAll<Element>(`[${this.attributeName}]`));
    if (target.hasAttribute(this.attributeName)) elements.push(target);

    for (const element of elements) {
      this.delegate.elementDisconnected(element);
    }
  }

  elementAttributeChanged(element: Element, attributeName: string) {
    if (attributeName !== this.attributeName) return;
    this.delegate.elementAttributeChanged?.(element, attributeName);
  }
}
