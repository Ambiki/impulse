import { warnUnlessCleanupRegistered } from './auto_cleanup';
import { DEFAULT_TIMEOUT, nextTask, startDeadline } from './timers';

/**
 * The events of the types a test names that reach one target, in the order they were dispatched.
 *
 * `Events` maps each type recorded to its event, as an event map does, such as
 * `{ 'accordion-item:shown': CustomEvent<{ id: string }> }`.
 */
export interface Recording<Events extends object = Record<string, Event>> {
  /** The events recorded so far. The same array is kept up to date. */
  readonly events: Events[keyof Events][];
  /** The `type` of each event recorded so far, which is what an assertion should compare. */
  readonly types: (keyof Events & string)[];
  /**
   * Resolves with the earliest recorded `type` event that an earlier `waitFor()` has not handed out. It resolves at
   * once when that event was dispatched before the call, so there is no listening too late, and two calls resolve with
   * two different events. It never resolves while the event is still being dispatched, so every listener has run by
   * the time the test goes on. Rejects at the deadline (1000ms unless `timeout` says otherwise; `Infinity` means none),
   * naming the types recorded, at once for a type the Recording does not keep, and once the Recording is stopped.
   */
  waitFor: <K extends keyof Events & string>(type: K, options?: { timeout?: number }) => Promise<Events[K]>;
  /** Ends the Recording early. `cleanup()` ends every Recording after each test. */
  stop: () => void;
}

/**
 * The event map of the events that reach `T`, by which `recordEvents()` types what it records. Each extends
 * `GlobalEventHandlersEventMap`, where an application declares its own events, so they are typed on every target.
 *
 * It is the map `T.addEventListener()` takes, with two exceptions. Any element is sent the events of
 * `HTMLElementEventMap`, even where `addEventListener()` takes fewer. And the map of `<body>` and `<svg>` leaves out
 * the window's own events, such as `popstate`, which are dispatched at the window and so never reach an element.
 */
type EventMapOf<T extends EventTarget> = T extends Window ?
  WindowEventMap :
  T extends Document ?
    DocumentEventMap :
    T extends HTMLVideoElement ?
      HTMLVideoElementEventMap :
      T extends HTMLMediaElement ?
        HTMLMediaElementEventMap :
        T extends Element ?
          HTMLElementEventMap :
          T extends ShadowRoot ?
            ShadowRootEventMap & GlobalEventHandlersEventMap :
            GlobalEventHandlersEventMap;

interface Waiter {
  type: string;
  resolve: (event: Event) => void;
  reject: (error: Error) => void;
  clearDeadline: () => void;
}

// Every Recording not yet stopped.
const recordings = new Set<Recording>();

/**
 * Starts a Recording: the events of `types` that reach `target` from now on, in the order they were dispatched.
 *
 * Like a `data-action` on `target`, it keeps the events bubbling up from its descendants, and with `self: true`, like
 * `.self`, only the ones `target` dispatched. Unlike a `data-action`, it listens in the capture phase, so it records an
 * event before any listener on a descendant, or any bubbling listener on `target`, has run. Those can neither stop the
 * event from being recorded nor have an event they dispatch recorded ahead of it.
 *
 * Each type is one of the event map of `target`, which is the map `target.addEventListener()` takes, so a type the
 * map does not declare is an error at compile time. Declare an element's events in `GlobalEventHandlersEventMap` so
 * that a Recording on any target, element, document, or window, types them:
 *
 * ```ts
 * declare global {
 *   interface GlobalEventHandlersEventMap {
 *     'accordion-item:shown': CustomEvent<{ id: string }>;
 *   }
 * }
 * ```
 *
 * @param target - The element, document, window, or other event target to record on.
 * @param types - The event types to record, written in full (`'accordion-item:show'`).
 * @param options - Optional settings.
 * @param options.self - Keep only the events `target` dispatched.
 * @returns The Recording. `cleanup()` stops it after the test.
 *
 * @example
 * ```ts
 * const recording = recordEvents(accordion, ['accordion-item:show', 'accordion-item:shown']);
 * accordion.toggleButton.click();
 * await recording.waitFor('accordion-item:shown');
 *
 * expect(recording.types).to.eql(['accordion-item:show', 'accordion-item:shown']);
 * ```
 */
export function recordEvents<T extends EventTarget, K extends keyof EventMapOf<T> & string>(
  target: T,
  types: readonly K[],
  options?: { self?: boolean },
): Recording<Pick<EventMapOf<T>, K>>;
export function recordEvents(
  target: EventTarget,
  types: readonly string[],
  { self = false }: { self?: boolean } = {},
): Recording {
  if (!Array.isArray(types)) {
    const given = types === null ? 'null' : typeof types;
    throw new TypeError(`recordEvents() takes the event types as an array, not ${given}.`);
  }
  const kept = new Set(types);
  const events: Event[] = [];
  // The events no `waitFor()` has handed out, oldest first, and the calls waiting for one, in the order they were made.
  const unclaimed: Event[] = [];
  const waiters: Waiter[] = [];
  let stopped = false;

  const typesOf = () => events.map((event) => event.type);
  // How a rejection lists what was recorded.
  const recordedList = () => (events.length > 0 ? typesOf().join(', ') : 'none');
  const stoppedError = (type: string) =>
    new Error(`No "${type}" before the recording was stopped. Recorded: ${recordedList()}.`);

  const listener = (event: Event) => {
    // As for a `data-action` on the target, a descendant's event counts only if it bubbles.
    const own = event.target === target;
    if (self ? !own : !own && !event.bubbles) return;
    events.push(event);
    const index = waiters.findIndex((waiter) => waiter.type === event.type);
    if (index === -1) {
      unclaimed.push(event);
      return;
    }
    const [waiter] = waiters.splice(index, 1);
    waiter.clearDeadline();
    void afterDispatch(event).then(waiter.resolve);
  };

  // Claims the earliest unclaimed `type` event for one `waitFor()`, or the next one to be recorded.
  const claim = (type: string, { timeout = DEFAULT_TIMEOUT }: { timeout?: number } = {}): Promise<Event> => {
    const index = unclaimed.findIndex((event) => event.type === type);
    if (index !== -1) return afterDispatch(unclaimed.splice(index, 1)[0]);
    if (!kept.has(type)) {
      return Promise.reject(new Error(`"${type}" is not one of the types recorded: ${Array.from(kept).join(', ')}.`));
    }
    if (stopped) return Promise.reject(stoppedError(type));

    return new Promise<Event>((resolve, reject) => {
      const waiter: Waiter = { type, resolve, reject, clearDeadline: () => {} };
      const deadline = startDeadline(timeout, () => {
        waiters.splice(waiters.indexOf(waiter), 1);
        reject(new Error(`No "${type}" within ${timeout}ms. Recorded: ${recordedList()}.`));
      });
      waiter.clearDeadline = deadline.clear;
      waiters.push(waiter);
    });
  };

  const recording: Recording = {
    events,
    get types() {
      return typesOf();
    },
    waitFor: claim,
    stop() {
      if (stopped) return;
      stopped = true;
      recordings.delete(recording);
      for (const type of kept) target.removeEventListener(type, listener, true);
      for (const waiter of waiters.splice(0)) {
        waiter.clearDeadline();
        waiter.reject(stoppedError(waiter.type));
      }
    },
  };

  warnUnlessCleanupRegistered();
  for (const type of kept) target.addEventListener(type, listener, true);
  recordings.add(recording);
  return recording;
}

/**
 * Resolves with `event` once its dispatch is over: at once when it already is, and otherwise in a later task. The
 * browser runs microtasks between the listeners of an event it dispatches itself (`toggle`, `transitionend`), so a wait
 * resolved while the event is still being dispatched would resume the test before the listeners yet to run, which for a
 * Recording, listening in the capture phase, is nearly all of them.
 */
function afterDispatch(event: Event): Promise<Event> {
  return event.eventPhase === Event.NONE ? Promise.resolve(event) : nextTask().then(() => event);
}

/** Stops every Recording. */
export function stopRecordings() {
  for (const recording of recordings) recording.stop();
}
