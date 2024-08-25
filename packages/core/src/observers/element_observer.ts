type ElementObserverDelegate = {
  elementConnected?: (element: Element) => void;
  elementDisconnected?: (element: Element) => void;
  elementAttributeChanged?: (element: Element, name: string) => void;
  getMatchingElements?: (element: Element) => Element[];
  matchesElement?: (element: Element) => boolean;
};

export default class ElementObserver {
  private observer: MutationObserver;
  private elements: Set<Element> = new Set();
  private started = false;

  constructor(
    private readonly element: Element,
    private delegate: ElementObserverDelegate,
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
          this.processAttributeChange(mutation.target, mutation.attributeName);
        } else if (mutation.type === 'childList') {
          this.processRemovedNodes(mutation.removedNodes);
          this.processAddedNodes(mutation.addedNodes);
        }
      }
    }
  }

  private processAttributeChange(element: Element, attributeName: string | null) {
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

  private getMatchingElements(element: Element = this.element): Element[] {
    return this.delegate.getMatchingElements?.(element) || [];
  }

  private matchesElement(element: Element): boolean {
    return this.delegate.matchesElement?.(element) ?? true;
  }

  private addElement(element: Element) {
    if (!this.elements.has(element) && this.elementIsActive(element)) {
      this.elements.add(element);
      this.delegate.elementConnected?.(element);
    }
  }

  private removeElement(element: Element) {
    if (this.elements.has(element)) {
      this.elements.delete(element);
      this.delegate.elementDisconnected?.(element);
    }
  }

  private elementFromNode(node: Node): Element | undefined {
    if (node.nodeType === Node.ELEMENT_NODE) {
      return node as Element;
    }

    return undefined;
  }

  private elementIsActive(element: Element): boolean {
    if (element.isConnected !== this.element.isConnected) {
      return false;
    }

    return this.element.contains(element);
  }
}
