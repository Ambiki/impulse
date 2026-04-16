import SelectorSet from './data_structures/selector_set';

interface Handler {
  selector: string;
  callback: (event: Event) => void;
  once: boolean;
  removed: boolean;
}

interface Bucket {
  selectorSet: SelectorSet<Handler>;
  listener: EventListener;
}

const buckets = new Map<string, Bucket>();
const stoppedEvents = new WeakSet<Event>();

/**
 * Sets up a delegated event listener that invokes `callback` whenever `eventName` fires on (or bubbles through) an
 * element matching `selector`.
 *
 * Internally a single document-level listener is shared across every call with the same `(eventName, capture)` pair,
 * so the cost of registering N call sites is O(1) listeners - not O(N). When the event fires, ancestors of
 * `event.target` are walked from inner to outer; for each ancestor that matches `selector`, `callback` is invoked with
 * `event.currentTarget` patched to point at the matched ancestor.
 *
 * `event.stopPropagation()` halts further delegated dispatch on the same event. Non-bubbling events (`focus`, `blur`,
 * `mouseenter`, `mouseleave`, `load`, `error`, `scroll`) require `{ capture: true }` so the document listener actually
 * sees them.
 *
 * @param eventName - The name of the event to listen for (e.g., 'click', 'focus', 'custom-event')
 * @param selector - CSS selector to match elements against
 * @param callback - Function to invoke when the event occurs. Receives the event.
 * @param options - Optional event listener options (capture, once, passive, etc.)
 * @returns A cleanup function that removes the registration
 *
 * @example
 * ```ts
 * // Listen for clicks on all buttons with inferred types
 * on('click', 'button', (event) => {
 *   console.log('Button clicked:', event.currentTarget);
 * });
 *
 * // Use event listener options
 * on('click', '.once-button', (event) => {
 *   console.log('Clicked once');
 * }, { once: true });
 *
 * // Manual cleanup
 * const stop = on('click', 'button', (event) => {
 *   console.log('Clicked');
 * });
 * stop();
 * ```
 */
// Tag name selector with inferred event type: on('click', 'button', ...)
export function on<E extends keyof HTMLElementEventMap>(
  eventName: E,
  selector: string,
  callback: (event: HTMLElementEventMap[E]) => void,
  options?: boolean | AddEventListenerOptions,
): () => void;
// Tag name selector with custom event type: on<CustomEvent, 'form'>('ajax', 'form', ...)
export function on<Ev extends Event>(
  eventName: string,
  selector: string,
  callback: (event: Ev) => void,
  options?: boolean | AddEventListenerOptions,
): () => void;
export function on(
  eventName: string,
  selector: string,
  callback: (event: Event) => void,
  options?: boolean | AddEventListenerOptions,
): () => void {
  const opts: AddEventListenerOptions = typeof options === 'boolean' ? { capture: options } : (options ?? {});
  const capture = !!opts.capture;
  const once = !!opts.once;

  const handler: Handler = { selector, callback, once, removed: false };
  const bucket = getBucket(eventName, capture);
  bucket.selectorSet.add(selector, handler);

  return () => {
    if (handler.removed) return;
    handler.removed = true;
    bucket.selectorSet.delete(selector, handler);
    maybeReleaseBucket(eventName, capture);
  };
}

/**
 * Dispatches a custom event from the specified target element.
 *
 * This is a convenience function for creating and dispatching CustomEvents with typed detail data.
 * Events are created with `bubbles: true` and `composed: true` by default, allowing them to
 * propagate through the DOM and cross shadow DOM boundaries.
 *
 * @param target - The element, window, or document to dispatch the event from
 * @param eventName - The name of the custom event
 * @param options - CustomEvent options including detail data and event configuration
 * @param options.detail - Typed detail payload attached to the event
 * @returns The CustomEvent that was dispatched
 *
 * @example
 * ```ts
 * // Dispatch a simple custom event
 * const button = document.querySelector('button');
 * emit(button, 'custom-click', { detail: { count: 1 } });
 *
 * // Dispatch with typed detail data
 * interface FormData {
 *   username: string;
 *   email: string;
 * }
 * const form = document.querySelector('form');
 * emit<FormData>(form, 'form-submit', {
 *   detail: { username: 'john', email: 'john@example.com' }
 * });
 *
 * // Dispatch without bubbling
 * emit(element, 'local-event', {
 *   detail: { message: 'Hello' },
 *   bubbles: false
 * });
 *
 * // Dispatch and access the event object
 * const event = emit(element, 'my-event', { detail: { success: true } });
 * console.log(event.defaultPrevented);
 * ```
 */
export function emit<T extends Record<string, any>>(
  target: Element | Window | Document,
  eventName: string,
  { detail = {} as T, ...rest }: CustomEventInit<T> = {},
) {
  const event = new CustomEvent(eventName, { bubbles: true, composed: true, detail, ...rest });
  target.dispatchEvent(event);
  return event;
}

function bucketKey(eventName: string, capture: boolean): string {
  return `${capture ? 'c' : 'b'}:${eventName}`;
}

function getBucket(eventName: string, capture: boolean): Bucket {
  const key = bucketKey(eventName, capture);
  const existing = buckets.get(key);
  if (existing) return existing;

  const selectorSet = new SelectorSet<Handler>();
  const listener: EventListener = (event) => dispatch(event, selectorSet, capture);
  document.addEventListener(eventName, listener, capture);
  const bucket: Bucket = { selectorSet, listener };
  buckets.set(key, bucket);
  return bucket;
}

function maybeReleaseBucket(eventName: string, capture: boolean) {
  const key = bucketKey(eventName, capture);
  const bucket = buckets.get(key);
  if (!bucket || bucket.selectorSet.size > 0) return;
  document.removeEventListener(eventName, bucket.listener, capture);
  buckets.delete(key);
}

function dispatch(event: Event, selectorSet: SelectorSet<Handler>, capture: boolean) {
  if (stoppedEvents.has(event)) return;
  // Firefox throws on `event.eventPhase` access for some re-dispatched CustomEvents; bail
  // rather than letting the error escape into the host event loop.
  try {
    void event.eventPhase;
  }
  catch {
    return;
  }
  const target = event.target;
  if (!(target instanceof Node)) return;

  const rawPath: EventTarget[] = typeof event.composedPath === 'function' ? event.composedPath() : ancestorsOf(target);
  const path = capture ? rawPath.slice().reverse() : rawPath;

  // Snapshot all matches before invoking any handler so that mutations made by one handler
  // (e.g. toggling a class) cannot affect whether a later handler matches.
  const matches: Array<{ node: Element; handler: Handler }> = [];
  for (const node of path) {
    if (!(node instanceof Element)) continue;
    for (const { value: handler } of selectorSet.matches(node)) {
      if (!handler.removed && node.matches(handler.selector)) {
        matches.push({ node, handler });
      }
    }
  }
  if (matches.length === 0) return;

  // Wrap stopPropagation / stopImmediatePropagation so we can observe each independently. Both
  // halt further dispatch across nodes; only the immediate variant additionally blocks remaining
  // handlers registered against the same node.
  let propagationStopped = false;
  let immediateStopped = false;
  const originalSP = event.stopPropagation;
  const originalSIP = event.stopImmediatePropagation;
  event.stopPropagation = function () {
    propagationStopped = true;
    originalSP.call(event);
  };
  event.stopImmediatePropagation = function () {
    propagationStopped = true;
    immediateStopped = true;
    originalSIP.call(event);
  };

  try {
    let lastNode: Element | undefined;
    for (const { node, handler } of matches) {
      if (immediateStopped) break;
      if (propagationStopped && lastNode !== undefined && node !== lastNode) break;
      if (handler.removed) continue;
      lastNode = node;

      Object.defineProperty(event, 'currentTarget', {
        configurable: true,
        get: () => node,
      });

      handler.callback.call(node, event);

      if (handler.once && !handler.removed) {
        handler.removed = true;
        selectorSet.delete(handler.selector, handler);
      }
    }
  } finally {
    if (propagationStopped) stoppedEvents.add(event);
    delete (event as unknown as Record<string, unknown>).currentTarget;
    delete (event as unknown as Record<string, unknown>).stopPropagation;
    delete (event as unknown as Record<string, unknown>).stopImmediatePropagation;
  }
}

function ancestorsOf(node: Node): Node[] {
  const path: Node[] = [];
  let current: Node | null = node;
  while (current) {
    path.push(current);
    current = current.parentNode;
  }
  return path;
}
