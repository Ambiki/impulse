import SelectorSet from '../data_structures/selector_set';
import { invokeReporting } from '../helpers/errors';
import { selectorAttributes } from '../helpers/selector';

export interface Watcher<T extends Element = Element> {
  elementConnected?: (element: T) => void;
  elementDisconnected?: (element: T) => void;
  /**
   * Only fires for elements still in the document when the mutation record is delivered. An element mutated and then
   * removed in the same task gets a single `elementDisconnected` instead.
   *
   * Fires for every attribute change the shared observer delivers. That always includes the attributes this watcher's
   * selector depends on, but may include attributes only other watchers depend on (every attribute, while any
   * registered selector is not read as self-contained), so check `attributeName`.
   */
  elementAttributeChanged?: (element: T, attributeName: string) => void;
}

interface RegisteredWatcher {
  selector: string;
  elementConnected?: (element: Element) => void;
  elementDisconnected?: (element: Element) => void;
  elementAttributeChanged?: (element: Element, attributeName: string) => void;
  elements: Set<Element>;
  attributes: string[] | null;
}

const watcherIndex = new SelectorSet<RegisteredWatcher>();
const watchersByElement = new WeakMap<Element, Set<RegisteredWatcher>>();
let mutationObserver: MutationObserver | null = null;
let observedRoot: Element | null = null;
// How many registered watchers depend on each attribute, and how many have a selector not read as self-contained (and
// so may depend on any attribute).
const attributeCounts = new Map<string, number>();
let anyAttributeWatchers = 0;
// The attributes the observer currently delivers, or `null` while it delivers every attribute.
let attributeFilter: Set<string> | null = null;
let attributeFilterTooWide = false;

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
    attributes: selectorAttributes(selector),
  };

  watcherIndex.add(selector, registered);
  countAttributes(registered.attributes, 1);
  ensureObserving(registered.attributes);

  for (const element of document.querySelectorAll(selector)) connect(element, registered);

  let stopped = false;
  return () => {
    // The attribute counts are not idempotent the way the index is, so a second call must not reach them.
    if (stopped) return;
    stopped = true;
    watcherIndex.delete(selector, registered);
    if (countAttributes(registered.attributes, -1)) attributeFilterTooWide = true;
    for (const element of registered.elements) {
      removeFromReverseIndex(element, registered);
    }
    registered.elements.clear();
    if (watcherIndex.size === 0) stopObserving();
  };
}

/**
 * Delivers every mutation record the shared observer has queued but not yet dispatched, so callers that need the index
 * to reflect the DOM as of now (rather than as of the last microtask checkpoint) can read it synchronously.
 */
export function flushMutations(): void {
  if (!mutationObserver) return;
  processMutations(mutationObserver.takeRecords());
}

/**
 * Starts the observer, or widens its attribute filter so a newly registered watcher sees every attribute it depends on.
 *
 * Child list and attribute changes are two registrations of the same observer, on `documentElement` and on `document`,
 * so records keep a single queue in mutation order. Changing the attribute filter re-observes `document`, and
 * re-observing a node drops the transient registered observers that keep a removed subtree observed until delivery.
 * Only the attribute registration's are dropped, so removals inside a detached subtree are never lost.
 */
function ensureObserving(attributes: string[] | null) {
  if (!mutationObserver) {
    mutationObserver = new MutationObserver(deliverMutations);
    observedRoot = document.documentElement;
    mutationObserver.observe(observedRoot, { childList: true, subtree: true });
    observeAttributes();
  } else if (!filterCovers(attributes)) {
    // Widening cannot wait: the new watcher needs records for changes made later in this task.
    observeAttributes();
  }
}

function filterCovers(attributes: string[] | null) {
  const filter = attributeFilter;
  if (!filter) return true;
  return attributes !== null && attributes.every((name) => filter.has(name));
}

function observeAttributes() {
  attributeFilterTooWide = false;
  const options: MutationObserverInit = { attributes: true, subtree: true };
  if (anyAttributeWatchers > 0) {
    attributeFilter = null;
  } else {
    attributeFilter = new Set(attributeCounts.keys());
    options.attributeFilter = Array.from(attributeFilter);
  }
  mutationObserver?.observe(document, options);
}

/**
 * Adjusts the counts for a watcher's attributes. Returns `true` when some attribute (or every attribute, for a selector
 * not read as self-contained) no longer has a watcher depending on it.
 */
function countAttributes(attributes: string[] | null, delta: 1 | -1): boolean {
  if (!attributes) {
    anyAttributeWatchers += delta;
    return anyAttributeWatchers === 0;
  }
  let emptied = false;
  for (const name of attributes) {
    const count = (attributeCounts.get(name) ?? 0) + delta;
    if (count === 0) {
      attributeCounts.delete(name);
      emptied = true;
    } else {
      attributeCounts.set(name, count);
    }
  }
  return emptied;
}

function deliverMutations(mutations: MutationRecord[]) {
  // Narrowing waits for delivery. The observer's transient registered observers were cleared just before this callback
  // and no watcher callback has run since, so re-observing here cannot drop an attribute record from a detached subtree
  // that is re-inserted later in the task. Until then the wider filter only delivers records nobody needs.
  if (attributeFilterTooWide) observeAttributes();
  processMutations(mutations);
}

function stopObserving() {
  if (!mutationObserver) return;
  const observer = mutationObserver;
  mutationObserver = null;
  processMutations(observer.takeRecords());
  observer.disconnect();
}

function processMutations(mutations: MutationRecord[]) {
  // Attributes are observed on `document` while child lists are observed on the root element. If that root has been
  // replaced, the attribute registration reaches elements the child list registration never walks, so attribute records
  // are dropped, as they were never recorded before. Checked once per batch: a record from the original root is for an
  // element no longer in the document, which `processAttributeChange` skips anyway.
  const rootReplaced = document.documentElement !== observedRoot;
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      mutation.removedNodes.forEach(walkRemoved);
      mutation.addedNodes.forEach(walkAdded);
    } else if (mutation.type === 'attributes' && !rootReplaced && mutation.target instanceof Element) {
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
