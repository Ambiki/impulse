import SelectorSet from '../data_structures/selector_set';
import { invokeReporting } from '../helpers/errors';

export interface Watcher<T extends Element = Element> {
  elementConnected?: (element: T) => void;
  elementDisconnected?: (element: T) => void;
  /**
   * Only fires for elements still in the document when the mutation record is delivered. An element mutated and then
   * removed in the same task gets a single `elementDisconnected` instead.
   */
  elementAttributeChanged?: (element: T, attributeName: string) => void;
}

interface RegisteredWatcher {
  selector: string;
  elementConnected?: (element: Element) => void;
  elementDisconnected?: (element: Element) => void;
  elementAttributeChanged?: (element: Element, attributeName: string) => void;
  elements: Set<Element>;
}

const watcherIndex = new SelectorSet<RegisteredWatcher>();
const watchersByElement = new WeakMap<Element, Set<RegisteredWatcher>>();
let mutationObserver: MutationObserver | null = null;

/**
 * Registers a watcher for elements matching `selector`. The shared document-level MutationObserver is started on first
 * registration and torn down once the last watcher is removed. A callback that throws is reported like an uncaught
 * error and never unwinds the observer or this function, so other watchers and later mutation records still run.
 *
 * Returns a cleanup function that deregisters the watcher and forgets every element it had matched. It does not fire
 * `elementDisconnected` for them; callers that need teardown must handle it themselves.
 */
export function watchSelector<T extends Element = Element>(selector: string, watcher: Watcher<T>): () => void {
  const registered: RegisteredWatcher = {
    selector,
    elementConnected: watcher.elementConnected as ((element: Element) => void) | undefined,
    elementDisconnected: watcher.elementDisconnected as ((element: Element) => void) | undefined,
    elementAttributeChanged: watcher.elementAttributeChanged as
      | ((element: Element, attributeName: string) => void) |
      undefined,
    elements: new Set(),
  };

  watcherIndex.add(selector, registered);
  ensureObserving();

  for (const element of document.querySelectorAll(selector)) connect(element, registered);

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
      processAttributeChange(mutation.target, mutation.attributeName);
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
    if (!watcher.elements.has(element) && element.matches(watcher.selector)) connect(element, watcher);
  }
}

function visitDisconnect(element: Element) {
  const watchers = watchersByElement.get(element);
  if (!watchers) return;
  for (const watcher of Array.from(watchers)) disconnect(element, watcher);
}

function processAttributeChange(element: Element, attributeName: string | null) {
  // A node removed in the same task as an attribute change still delivers that record through its transient registered
  // observer, and `isConnected` reflects the tree at delivery time. The `childList` record for the removal is in the
  // same batch (before or after this one) and `walkRemoved` handles the disconnect, so there is nothing to do here;
  // matching now would fire `elementConnected` for an element that will never be disconnected.
  if (!element.isConnected) return;

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
      connect(element, watcher);
    } else if (!matchesNow && wasMatching) {
      disconnect(element, watcher);
    } else if (matchesNow && wasMatching) {
      invokeReporting(() => watcher.elementAttributeChanged?.(element, attributeName ?? ''));
    }
  }
}

// The index is updated before the callback runs, so a throwing callback can only affect its own work: it is reported
// like an uncaught error and the remaining callbacks and mutation records still run.
function connect(element: Element, watcher: RegisteredWatcher) {
  addMatch(element, watcher);
  invokeReporting(() => watcher.elementConnected?.(element));
}

function disconnect(element: Element, watcher: RegisteredWatcher) {
  removeMatch(element, watcher);
  invokeReporting(() => watcher.elementDisconnected?.(element));
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
