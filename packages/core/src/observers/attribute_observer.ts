import { ElementObserver, type ElementObserverDelegate } from './element_observer';

export type AttributeObserverDelegate<T> = {
  elementConnected?: (element: T) => void;
  elementDisconnected?: (element: T) => void;
  elementAttributeChanged?: (element: T, name: string) => void;
};

export class AttributeObserver<T extends Element = Element> implements ElementObserverDelegate<T> {
  private elementObserver: ElementObserver<T>;

  constructor(
    private readonly instance: Element,
    private readonly attributeName: string,
    private delegate: AttributeObserverDelegate<T>
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

  elementConnected(element: T) {
    this.delegate.elementConnected?.(element);
  }

  elementDisconnected(element: T) {
    this.delegate.elementDisconnected?.(element);
  }

  elementAttributeChanged(element: T, attributeName: string) {
    if (attributeName === this.attributeName) {
      this.delegate.elementAttributeChanged?.(element, attributeName);
    }
  }

  /**
   * Returns the elements that match the selector. Called by the ElementObserver.
   */
  getMatchingElements(element: T) {
    const elements = Array.from(element.querySelectorAll<T>(`[${this.attributeName}]`));
    if (element.hasAttribute(this.attributeName)) {
      elements.unshift(element);
    }

    return elements;
  }

  /**
   * Returns true if the element has the attribute. Called by the ElementObserver.
   */
  matchesElement(element: T) {
    return element.hasAttribute(this.attributeName);
  }
}
