import ElementObserver from './element_observer';

type AttributeObserverDelegate = {
  elementConnected?: (element: Element) => void;
  elementDisconnected?: (element: Element) => void;
  elementAttributeChanged?: (element: Element, name: string) => void;
};

export default class AttributeObserver {
  private elementObserver: ElementObserver;

  constructor(
    private readonly instance: Element,
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
    this.delegate.elementConnected?.(element);
  }

  elementDisconnected(element: Element) {
    this.delegate.elementDisconnected?.(element);
  }

  elementAttributeChanged(element: Element, attributeName: string) {
    if (attributeName === this.attributeName) {
      this.delegate.elementAttributeChanged?.(element, attributeName);
    }
  }

  /**
   * Returns the elements that match the selector. Called by the ElementObserver.
   */
  getMatchingElements(element: Element) {
    const elements = Array.from(element.querySelectorAll(`[${this.attributeName}]`));
    if (element.hasAttribute(this.attributeName)) {
      elements.unshift(element);
    }

    return elements;
  }

  /**
   * Returns true if the element has the attribute. Called by the ElementObserver.
   */
  matchesElement(element: Element) {
    return element.hasAttribute(this.attributeName);
  }
}
