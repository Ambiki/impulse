export type ElementObserverDelegate<T> = {
  elementConnected?: (element: T) => void;
  elementDisconnected?: (element: T) => void;
  elementAttributeChanged?: (element: T, name: string) => void;
  getMatchingElements?: (element: T) => T[];
  matchesElement?: (element: T) => boolean;
};

export class ElementObserver<T extends Element = Element> {
  private observer: MutationObserver;
  private elements: Set<T> = new Set();
  private started = false;

  constructor(
    private readonly element: Element,
    private delegate: ElementObserverDelegate<T>,
    private readonly observerOptions?: MutationObserverInit
  ) {
    this.element = element;
    this.delegate = delegate;
    this.observer = new MutationObserver((mutations) => this.processMutations(mutations));
    this.observerOptions = observerOptions;
  }

  start() {
    if (!this.started) {
      this.started = true;
      this.observer.observe(this.element, { childList: true, subtree: true, ...this.observerOptions });
      // Initialize elements that are already in the DOM.
      this.initializeElements();
    }
  }

  stop() {
    if (this.started) {
      this.observer.takeRecords();
      this.observer.disconnect();
      this.started = false;
    }
  }

  private initializeElements() {
    for (const element of this.getMatchingElements()) {
      this.addElement(element);
    }
  }

  private processMutations(mutations: MutationRecord[]) {
    if (this.started) {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.target instanceof Element) {
          this.processAttributeChange(mutation.target as T, mutation.attributeName);
        } else if (mutation.type === 'childList') {
          this.processRemovedNodes(mutation.removedNodes);
          this.processAddedNodes(mutation.addedNodes);
        }
      }
    }
  }

  private processAttributeChange(element: T, attributeName: string | null) {
    if (this.elements.has(element)) {
      // If the delegate does not implement elementAttributeChanged, remove the element.
      if (this.delegate.elementAttributeChanged && this.matchesElement(element)) {
        this.delegate.elementAttributeChanged(element, attributeName || '');
      } else {
        this.removeElement(element);
      }
    } else if (this.matchesElement(element)) {
      this.addElement(element);
    }
  }

  private processRemovedNodes(nodes: NodeList) {
    for (const node of Array.from(nodes)) {
      const element = this.elementFromNode(node);
      if (element) {
        for (const ele of this.getMatchingElements(element)) {
          this.removeElement(ele);
        }
      }
    }
  }

  private processAddedNodes(nodes: NodeList) {
    for (const node of Array.from(nodes)) {
      const element = this.elementFromNode(node);
      if (element) {
        for (const ele of this.getMatchingElements(element)) {
          this.addElement(ele);
        }
      }
    }
  }

  private getMatchingElements(element = this.element): T[] {
    return this.delegate.getMatchingElements?.(element as T) || [];
  }

  private matchesElement(element: T): boolean {
    return this.delegate.matchesElement?.(element) ?? true;
  }

  private addElement(element: T) {
    if (!this.elements.has(element) && this.elementIsActive(element)) {
      this.elements.add(element);
      this.delegate.elementConnected?.(element);
    }
  }

  private removeElement(element: T) {
    if (this.elements.has(element)) {
      this.elements.delete(element);
      this.delegate.elementDisconnected?.(element);
    }
  }

  private elementFromNode(node: Node): T | undefined {
    if (node.nodeType === Node.ELEMENT_NODE) {
      return node as T;
    }

    return undefined;
  }

  private elementIsActive(element: T): boolean {
    if (element.isConnected !== this.element.isConnected) {
      return false;
    }

    return this.element.contains(element);
  }
}
