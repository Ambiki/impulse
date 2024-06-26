type ElementObserverDelegate = {
  elementConnected?: (element: Element) => void;
  elementDisconnected?: (element: Element) => void;
  elementAttributeChanged?: (element: Element, name: string) => void;
};

export default class ElementObserver {
  private observer: MutationObserver;
  private started = false;

  constructor(
    private readonly element: Element | Document,
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
    }
  }

  stop() {
    if (this.started) {
      this.observer.takeRecords();
      this.observer.disconnect();
      this.started = false;
    }
  }

  private processMutations(mutations: MutationRecord[]) {
    if (this.started) {
      for (const mutation of mutations) {
        this.processMutation(mutation);
      }
    }
  }

  private processMutation(mutation: MutationRecord) {
    if (mutation.type === 'attributes' && mutation.target instanceof Element) {
      this.processAttributeChange(mutation.target, mutation.attributeName);
    } else if (mutation.type === 'childList') {
      this.processRemovedNodes(mutation.removedNodes);
      this.processAddedNodes(mutation.addedNodes);
    }
  }

  private processAttributeChange(element: Element, attributeName: string | null) {
    if (attributeName) {
      this.delegate.elementAttributeChanged?.(element, attributeName);
    }
  }

  private processRemovedNodes(nodes: NodeList) {
    for (const node of Array.from(nodes)) {
      const element = this.elementFromNode(node);
      if (element) {
        this.delegate.elementDisconnected?.(element);
      }
    }
  }

  private processAddedNodes(nodes: NodeList) {
    for (const node of Array.from(nodes)) {
      const element = this.elementFromNode(node);
      if (element && this.elementIsActive(element)) {
        this.delegate.elementConnected?.(element);
      }
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
