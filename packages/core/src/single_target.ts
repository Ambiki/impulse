import { byDocumentOrder } from './helpers/dom';
import { invokeReporting } from './helpers/errors';

/**
 * What a `@target()` field's rule needs from the `Target` that owns it. A `Target` passes itself, so its fields share
 * one host rather than each holding closures of its own.
 */
export interface SingleTargetHost<T extends Element> {
  /** Whether `element` claims the field `key` as the DOM stands, whatever has been delivered. */
  claims: (key: string, element: T) => boolean;
  /** Every element claiming the field `key` as the DOM stands, in document order. */
  claimants: (key: string) => T[];
  /** Invokes `[key]Connected` with `element`. */
  connected: (key: string, element: T) => void;
  /** Invokes `[key]Disconnected` with `element`. */
  disconnected: (key: string, element: T) => void;
  /** Reports that the field `key` was left with a second Claimant: a mistake that `@targets()` is for. */
  reportMultiple: (key: string) => void;
  /** Whether the Owner is subscribed. It is not while it is torn down, when nothing waiting is to be connected. */
  active: () => boolean;
  /** The number of the delivery running, or `0` when none is. Two calls agree only within one delivery. */
  clock: () => number;
  /** Runs `task` once the run of deliveries now in progress is over: a microtask queued from inside it. */
  afterRun: (task: () => void) => void;
  /** Runs `task` as a delivery of its own, as the changes it hands to callbacks are. */
  deliver: (task: () => void) => void;
}

/**
 * The rule that decides which Claimant is a `@target()` field's Target, kept for one field.
 *
 * `Target` reports each element that starts claiming the field (`claim`) and each that stops (`release`) as the
 * changes are delivered, and the rule decides who is connected and disconnected. It also answers what the field reads
 * while changes wait to be delivered (`now`), the same rule asked of the DOM as it stands (docs/adr/0006).
 */
export interface SingleTarget<T extends Element> {
  /** The Target as delivered: the element the field holds, from its `[key]Connected` until its `[key]Disconnected`. */
  readonly target: T | null;
  /** Reports that `element` has started claiming the field. */
  claim: (element: T) => void;
  /** Reports that `element` no longer claims the field. */
  release: (element: T) => void;
  /** The Target the field will have once the changes waiting are delivered, worked out from the DOM. */
  now: () => T | null;
  /** Forgets the field's history once the Owner is torn down, so removed elements are not kept alive. */
  reset: () => void;
}

/**
 * Creates the rule for the `@target()` field `key` of the Owner `host` stands for. `Target` creates one per `@target()`
 * field, passing itself as the host.
 */
export function createSingleTarget<T extends Element>(host: SingleTargetHost<T>, key: string): SingleTarget<T> {
  return new SingleTargetField(host, key);
}

class SingleTargetField<T extends Element> implements SingleTarget<T> {
  private current: T | null = null;
  // Claimants that are not the Target. They have had no `[key]Connected`; one of them is adopted when the Target goes
  // away, so a replacement inserted before the element it replaces is removed is not lost.
  private readonly waiting = new Set<T>();
  // The Claimants a report is scheduled for (see `reportIfLeftWaiting`), made on first use: almost no field needs one.
  private reportsPending: Set<T> | null = null;
  // The delivery since which the Target has held the field, a move counting as holding on (see `takesOver`).
  private heldSince: number | undefined;
  // The Target the field last lost, the delivery since which it had held it, and the delivery it left in (see
  // `keptForMovedTarget`).
  private departed: { element: T; since: number; delivery: number } | null = null;

  constructor(
    private readonly host: SingleTargetHost<T>,
    private readonly key: string,
  ) {}

  get target(): T | null {
    return this.current;
  }

  claim(element: T) {
    const target = this.current;
    if (target && this.takesOver(target, element)) {
      this.handOver(target, element);
      return;
    }
    // The field holds one element. A second one is kept waiting rather than dropped, so the field and the callbacks
    // only ever see the Target.
    if (target || this.keptForMovedTarget(element)) {
      this.waiting.add(element);
      this.reportIfLeftWaiting(element);
      // Should the moved Target not come back after all, the field is not left empty with a Claimant waiting.
      if (!target) this.adoptAfterRun();
      return;
    }
    this.connect(element);
  }

  release(element: T) {
    // A waiting element never had a `[key]Connected`, so it goes without a `[key]Disconnected`.
    if (this.waiting.delete(element) || this.current !== element) return;
    // The callback still sees the Target in the field; it is forgotten afterwards, even if the callback throws.
    try {
      this.host.disconnected(this.key, element);
    } finally {
      const delivery = this.host.clock();
      this.current = null;
      this.departed = { element, since: this.heldSince ?? delivery, delivery };
      this.adoptWaiting(element);
    }
  }

  /**
   * The element the field will have as its Target once the changes waiting are delivered. The Target keeps the field
   * while it still claims it, and otherwise the first Claimant in document order takes it: `adoptWaiting` picks that
   * one when the Target leaves, and `takesOver` hands the field to it when it is reached after another Claimant.
   */
  now(): T | null {
    const target = this.current;
    if (target && this.host.claims(this.key, target)) return target;
    return this.host.claimants(this.key)[0] ?? null;
  }

  reset() {
    this.heldSince = undefined;
    this.departed = null;
  }

  private connect(element: T) {
    this.current = element;
    // A Target that left earlier in this delivery and is back was moved: it has held the field all along.
    const delivery = this.host.clock();
    const departed = this.departed;
    const moved = departed?.element === element && departed.delivery === delivery;
    this.heldSince = moved ? departed.since : delivery;
    this.host.connected(this.key, element);
  }

  /**
   * Whether `Claimant` takes the field from its Target, `target`. A read made before this delivery took the field's
   * Target from then while it still claimed the field, and otherwise the first Claimant in document order (`now`). So a
   * Target that only got the field in this delivery gives way to a Claimant ahead of it, and one that held it before
   * keeps it, the Claimant waiting behind it.
   */
  private takesOver(target: T, claimant: T): boolean {
    return (
      this.heldSince === this.host.clock() &&
      byDocumentOrder(claimant, target) < 0 &&
      this.host.claims(this.key, claimant) &&
      this.host.claims(this.key, target)
    );
  }

  /**
   * Makes `Claimant` the Target in place of `target`, which waits behind it as a second Claimant does:
   * `[key]Disconnected` for `target`, then `[key]Connected` for `Claimant`.
   *
   * `target` is already waiting when its callback runs, so a teardown the callback causes finds nothing of it left to
   * disconnect, and after a teardown nothing is connected.
   */
  private handOver(target: T, claimant: T) {
    this.waiting.add(target);
    try {
      this.host.disconnected(this.key, target);
    } finally {
      this.current = null;
      if (this.host.active()) {
        this.reportIfLeftWaiting(target);
        // Reported rather than thrown, as in `adoptWaiting`: it can run while a throwing `[key]Disconnected` unwinds.
        invokeReporting(() => this.connect(claimant));
      }
    }
  }

  /**
   * Whether the field, with no Target, is kept for the one it had before this delivery. That Target left the field
   * earlier in the delivery but still claims it in the DOM, so it was moved and its claim is about to be delivered
   * again. A read made before the delivery said it keeps the field (`now`), so `element` waits.
   */
  private keptForMovedTarget(element: T): boolean {
    const departed = this.departed;
    return (
      departed !== null &&
      departed.element !== element &&
      departed.delivery === this.host.clock() &&
      departed.since !== departed.delivery &&
      this.host.claims(this.key, departed.element)
    );
  }

  /**
   * Adopts the first waiting element in document order as the Target of a field that has just lost its own, invoking
   * `[key]Connected` for it. `departed` is the Target whose release freed the field.
   *
   * An element is only released when the change saying so is delivered, and a batch of changes is delivered one record
   * at a time, so what has been delivered can be behind the document. The DOM is asked what it says now:
   *
   * - The Target may have been moved rather than removed. It is released here and claims the field again with the
   *   record that follows, so it is left to come back rather than replaced.
   * - A waiting element may already be detached, sit under another owner, or have had the field rewritten out of its
   *   attribute, with the release saying so queued behind this one. Adopting it would invoke `[key]Connected` for an
   *   element that is about to be forgotten.
   */
  private adoptWaiting(departed?: T) {
    // Nothing is waiting behind almost every Target that goes away. While the Owner is torn down every element is being
    // released, the waiting ones too, so there is nobody to adopt. And on a second look, the field may have a Target
    // again.
    if (!this.host.active() || this.waiting.size === 0 || this.current) return;
    if (departed && this.host.claims(this.key, departed)) return;

    const claiming = Array.from(this.waiting).filter((element) => this.host.claims(this.key, element));
    const [next] = claiming.sort(byDocumentOrder);
    if (!next) {
      // Every waiting element no longer claims the field, and is normally about to be released. A callback invoked
      // later in this batch can put the field back first, though: the attribute then ends where it began, no record
      // reports a change, and the element stays waiting behind nobody. One more look once the run is over finds it.
      if (departed) this.adoptAfterRun();
      return;
    }

    this.waiting.delete(next);
    // Reported rather than thrown: this can run while a `[key]Disconnected` that has itself thrown is unwinding, and an
    // error raised here would replace that one instead of joining it.
    invokeReporting(() => this.connect(next));
  }

  /** Looks again for a waiting Claimant to adopt once the run is over, as a delivery of its own. */
  private adoptAfterRun() {
    this.host.afterRun(() => this.host.deliver(() => this.adoptWaiting()));
  }

  /**
   * Reports a second Claimant, unless it has stopped waiting by the time the run of deliveries it arrived in is over.
   * Replacing a Target by inserting the new element before removing the old one passes through two Claimants without
   * being a mistake. Two that are both still there afterwards are one.
   */
  private reportIfLeftWaiting(element: T) {
    // One report per Claimant in a run, however often it starts waiting in it: moved, or adopted and displaced again.
    const pending = (this.reportsPending ??= new Set());
    if (pending.has(element)) return;
    pending.add(element);
    this.host.afterRun(() => {
      pending.delete(element);
      if (this.waiting.has(element)) this.host.reportMultiple(this.key);
    });
  }
}
