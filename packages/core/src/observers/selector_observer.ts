import { getMatchingElementsFrom } from '../helpers/dom';
import { ElementObserver } from './element_observer';
import { type ElementObserverDelegate } from './element_observer';

export type SelectorObserverDelegate<T = Element> = {
  elementConnected?: (element: T) => void;
  elementDisconnected?: (element: T) => void;
};

export class SelectorObserver<T extends Element = Element> implements ElementObserverDelegate<T> {
  private elementObserver: ElementObserver<T>;

  constructor(
    private readonly instance: Element,
    private readonly selector: string,
    private delegate: SelectorObserverDelegate<T>
  ) {
    this.instance = instance;
    this.selector = selector;
    this.elementObserver = new ElementObserver(this.instance, this, { attributes: true });
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

  elementAttributeChanged() {
    //
  }

  /**
   * Returns the elements that match the selector. Called by the ElementObserver.
   */
  getMatchingElements(element: T) {
    return getMatchingElementsFrom<T>(element, this.selector);
  }

  /**
   * Returns true if the element matches the selector. Called by the ElementObserver.
   */
  matchesElement(element: T) {
    return element.matches(this.selector);
  }
}
