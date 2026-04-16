import SelectorSet from '../data_structures/selector_set';

export interface Watcher<T extends Element = Element> {
  elementConnected?: (element: T) => void;
  elementDisconnected?: (element: T) => void;
}

interface RegisteredWatcher {
  selector: string;
  elementConnected?: (element: Element) => void;
  elementDisconnected?: (element: Element) => void;
  elements: Set<Element>;
}

const watcherIndex = new SelectorSet<RegisteredWatcher>();
const watchersByElement = new WeakMap<Element, Set<RegisteredWatcher>>();
let mutationObserver: MutationObserver | null = null;

/**
 * Registers a watcher for elements matching `selector`. The shared document-level MutationObserver is started on first
 * registration and torn down once the last watcher is removed.
 *
 * Returns a cleanup function that deregisters the watcher and synchronously fires `elementDisconnected` for every
 * element it had previously matched.
 */
export function watchSelector<T extends Element = Element>(selector: string, watcher: Watcher<T>): () => void {
  const registered: RegisteredWatcher = {
    selector,
    elementConnected: watcher.elementConnected as ((element: Element) => void) | undefined,
    elementDisconnected: watcher.elementDisconnected as ((element: Element) => void) | undefined,
    elements: new Set(),
  };

  watcherIndex.add(selector, registered);
  ensureObserving();

  for (const element of document.querySelectorAll(selector)) {
    addMatch(element, registered);
    registered.elementConnected?.(element);
  }

  return () => {
    watcherIndex.delete(selector, registered);
    for (const element of registered.elements) {
      removeFromReverseIndex(element, registered);
    }
    registered.elements.clear();
    if (watcherIndex.size === 0) stopObserving();
  };
}

function ensureObserving() {
  if (mutationObserver) return;
  mutationObserver = new MutationObserver(processMutations);
  mutationObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
}

function stopObserving() {
  if (!mutationObserver) return;
  const observer = mutationObserver;
  mutationObserver = null;
  processMutations(observer.takeRecords());
  observer.disconnect();
}

function processMutations(mutations: MutationRecord[]) {
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      mutation.removedNodes.forEach(walkRemoved);
      mutation.addedNodes.forEach(walkAdded);
    } else if (mutation.type === 'attributes' && mutation.target instanceof Element) {
      processAttributeChange(mutation.target);
    }
  }
}

function walkAdded(node: Node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const root = node as Element;
  visitConnect(root);
  for (const element of root.querySelectorAll('*')) visitConnect(element);
}

function walkRemoved(node: Node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const root = node as Element;
  visitDisconnect(root);
  for (const element of root.querySelectorAll('*')) visitDisconnect(element);
}

function visitConnect(element: Element) {
  if (!element.isConnected) return;
  for (const { value: watcher } of watcherIndex.matches(element)) {
    if (!watcher.elements.has(element) && element.matches(watcher.selector)) {
      addMatch(element, watcher);
      watcher.elementConnected?.(element);
    }
  }
}

function visitDisconnect(element: Element) {
  const watchers = watchersByElement.get(element);
  if (!watchers) return;
  for (const watcher of Array.from(watchers)) {
    removeMatch(element, watcher);
    watcher.elementDisconnected?.(element);
  }
}

function processAttributeChange(element: Element) {
  const previouslyMatching = watchersByElement.get(element);
  const candidates = new Set<RegisteredWatcher>();
  for (const { value: watcher } of watcherIndex.matches(element)) candidates.add(watcher);

  const all = new Set<RegisteredWatcher>(candidates);
  if (previouslyMatching) {
    for (const watcher of previouslyMatching) all.add(watcher);
  }

  for (const watcher of all) {
    const wasMatching = previouslyMatching?.has(watcher) === true;
    const matchesNow = element.matches(watcher.selector);
    if (matchesNow && !wasMatching) {
      addMatch(element, watcher);
      watcher.elementConnected?.(element);
    } else if (!matchesNow && wasMatching) {
      removeMatch(element, watcher);
      watcher.elementDisconnected?.(element);
    }
  }
}

function addMatch(element: Element, watcher: RegisteredWatcher) {
  watcher.elements.add(element);
  let set = watchersByElement.get(element);
  if (!set) {
    set = new Set();
    watchersByElement.set(element, set);
  }
  set.add(watcher);
}

function removeMatch(element: Element, watcher: RegisteredWatcher) {
  watcher.elements.delete(element);
  removeFromReverseIndex(element, watcher);
}

function removeFromReverseIndex(element: Element, watcher: RegisteredWatcher) {
  const set = watchersByElement.get(element);
  if (!set) return;
  set.delete(watcher);
  if (set.size === 0) watchersByElement.delete(element);
}
