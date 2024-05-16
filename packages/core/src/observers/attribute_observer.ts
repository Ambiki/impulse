import ElementObserver from './element_observer';

type AttributeObserverDelegate = {
  elementConnected?: (element: Element) => void;
  elementDisconnected?: (element: Element) => void;
  elementAttributeChanged?: (element: Element, name: string) => void;
};

export default class AttributeObserver {
  private elementObserver: ElementObserver;

  constructor(
    private readonly instance: Element | Document,
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

  elementConnected(element: Element) {
    const elements = this.getMatchingElements(element);
    for (const ele of elements) {
      this.delegate.elementConnected?.(ele);
    }
  }

  elementDisconnected(element: Element) {
    const elements = this.getMatchingElements(element);
    for (const ele of elements) {
      this.delegate.elementDisconnected?.(ele);
    }
  }

  elementAttributeChanged(element: Element, attributeName: string) {
    if (attributeName === this.attributeName) {
      this.delegate.elementAttributeChanged?.(element, attributeName);
    }
  }

  private getMatchingElements(element: Element) {
    const elements = Array.from(element.querySelectorAll(`[${this.attributeName}]`));
    if (element.hasAttribute(this.attributeName)) {
      elements.unshift(element);
    }

    return elements;
  }
}
