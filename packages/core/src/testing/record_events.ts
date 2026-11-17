import { DEFAULT_TIMEOUT, startDeadline } from './timers';

/** The events of the types a test names that reach one target, in the order they were dispatched. */
export interface Recording {
  /** The events recorded so far. The same array is kept up to date. */
  readonly events: Event[];
  /** The `type` of each event recorded so far, which is what an assertion should compare. */
  readonly types: string[];
  /**
   * Resolves with the earliest recorded `type` event that an earlier `waitFor()` has not handed out. It resolves at once
   * when that event was dispatched before the call, so there is no listening too late, and two calls resolve with two
   * different events. Rejects at the deadline (1000ms unless `timeout` says otherwise), naming the types recorded, at
   * once for a type the Recording does not keep, and once the Recording is stopped.
   */
  waitFor: (type: string, options?: { timeout?: number }) => Promise<Event>;
  /** Ends the Recording early. `cleanup()` ends every Recording after each test. */
  stop: () => void;
}

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
 * `.self`, only the ones `target` dispatched. It listens in the capture phase, so it records an event before any
 * listener can stop it from going further.
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
export function recordEvents(
  target: EventTarget,
  types: string[],
  { self = false }: { self?: boolean } = {},
): Recording {
  if (!Array.isArray(types)) {
    throw new TypeError(`recordEvents() takes the event types as an array, not ${types === null ? 'null' : typeof types}.`);
  }
  const kept = new Set(types);
  const events: Event[] = [];
  // The events no `waitFor()` has handed out, oldest first, and the calls waiting for one, in the order they were made.
  const unclaimed: Event[] = [];
  const waiters: Waiter[] = [];
  let stopped = false;

  const typesRecorded = () => events.map((event) => event.type);
  const recorded = () => (events.length > 0 ? typesRecorded().join(', ') : 'none');

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
    waiter.resolve(event);
  };

  const recording: Recording = {
    events,
    get types() {
      return typesRecorded();
    },
    waitFor(type, { timeout = DEFAULT_TIMEOUT } = {}) {
      const index = unclaimed.findIndex((event) => event.type === type);
      if (index !== -1) return Promise.resolve(unclaimed.splice(index, 1)[0]);
      if (!kept.has(type)) {
        return Promise.reject(new Error(`"${type}" is not one of the types recorded: ${Array.from(kept).join(', ')}.`));
      }
      if (stopped) return Promise.reject(new Error(`No "${type}" before the recording was stopped. Recorded: ${recorded()}.`));

      return new Promise<Event>((resolve, reject) => {
        const waiter: Waiter = { type, resolve, reject, clearDeadline: () => {} };
        const deadline = startDeadline(timeout, () => {
          waiters.splice(waiters.indexOf(waiter), 1);
          reject(new Error(`No "${type}" within ${timeout}ms. Recorded: ${recorded()}.`));
        });
        waiter.clearDeadline = deadline.clear;
        waiters.push(waiter);
      });
    },
    stop() {
      if (stopped) return;
      stopped = true;
      recordings.delete(recording);
      for (const type of kept) target.removeEventListener(type, listener, true);
      for (const waiter of waiters.splice(0)) {
        waiter.clearDeadline();
        waiter.reject(new Error(`No "${waiter.type}" before the recording was stopped. Recorded: ${recorded()}.`));
      }
    },
  };

  for (const type of kept) target.addEventListener(type, listener, true);
  recordings.add(recording);
  return recording;
}

/** Stops every Recording. */
export function stopRecordings() {
  for (const recording of recordings) recording.stop();
}
