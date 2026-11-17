import { ImpulseElement, isInitialized } from '../index';
import { DEFAULT_TIMEOUT, nextTask, startDeadline } from './timers';

/**
 * Resolves once the document is Settled: no change is waiting to be delivered, no connected custom element is undefined,
 * and every connected Impulse element is Initialized. Call it after changing the DOM, before asserting on what Impulse
 * does with the change.
 *
 * It is a state of the whole document, open shadow trees included, never of a subtree: an element a test appends
 * anywhere is waited for. A custom element whose name can never be defined, such as `<tr is="vue:row">`, does not count.
 * An Impulse element in a closed shadow root is out of reach; wait for it with `whenInitialized()`.
 *
 * An element that is not defined holds the wait rather than failing it at once, so one defined by a `lazyImport()` still
 * in flight is waited for, and one that is never defined (a typo, a missing import) fails it at the deadline.
 *
 * @param options - Optional settings.
 * @param options.timeout - Milliseconds to wait before rejecting, 1000 by default.
 * @returns A promise that resolves once the document is Settled, and rejects at the deadline naming each element it was
 * still waiting on.
 *
 * @example
 * ```ts
 * group.append(item);
 * await whenSettled();
 *
 * expect(group.items).to.have.length(3);
 * ```
 */
export async function whenSettled({ timeout = DEFAULT_TIMEOUT }: { timeout?: number } = {}): Promise<void> {
  const deadline = startDeadline(timeout);
  try {
    // A task at a time: each runs every delivery and init step Impulse had pending, so the check that follows sees the
    // document as Impulse left it. The check runs once more after the deadline, so a document that settled just then
    // passes.
    for (;;) {
      await nextTask();
      const { pending, unknown } = inspect();
      if (unknown) continue;
      if (pending.length === 0) return;
      if (deadline.passed) throw new Error(`Not settled within ${timeout}ms: ${pending.join('; ')}.`);
    }
  } finally {
    deadline.clear();
  }
}

/**
 * What keeps the document from being Settled, as one description per tag: the custom elements that are not defined,
 * then the Impulse elements that are not Initialized. `unknown` is whether a name was found that
 * no earlier check had seen, which cannot be classified until the next task.
 */
function inspect(): { pending: string[]; unknown: boolean } {
  const notDefined = new Set<string>();
  const notInitialized = new Set<string>();
  let unknown = false;

  const visit = (root: Document | ShadowRoot) => {
    for (const element of root.querySelectorAll(':not(:defined)')) {
      const name = definitionName(element);
      // A name that has a definition belongs to an element that can no longer become defined: its constructor threw,
      // or it is a customized built-in whose definition extends another tag.
      if (name === null || customElements.get(name)) continue;
      const definable = isDefinable(name);
      if (definable === undefined) unknown = true;
      else if (definable) notDefined.add(name === element.localName ? `<${name}>` : `<${element.localName} is="${name}">`);
    }
    for (const element of root.querySelectorAll('*')) {
      if (element instanceof ImpulseElement && !isInitialized(element)) notInitialized.add(`<${element.localName}>`);
      if (element.shadowRoot) visit(element.shadowRoot);
    }
  };
  visit(document);

  return {
    pending: [
      ...Array.from(notDefined, (tag) => `${tag} is not defined`),
      ...Array.from(notInitialized, (tag) => `${tag} is not initialized`),
    ],
    unknown,
  };
}

/**
 * The name an undefined element is defined under: its tag name for an autonomous custom element, and its `is` for a
 * customized built-in (`<button is="fancy-button">`), which `document.createElement('button', { is })` sets without an
 * attribute. Serializing the element still writes that one, after its attributes. (Not a shallow clone's: cloning an
 * element whose `is` has a definition runs the constructor.)
 */
function definitionName(element: Element): string | null {
  if (element.localName.includes('-')) return element.localName;
  const attribute = element.getAttribute('is');
  if (attribute !== null) return attribute;
  return /^<[^\s>]+(?:\s[^\s=]+="[^"]*")*\sis="([^"]*)"/.exec(element.outerHTML)?.[1] ?? null;
}

// The names `customElements.whenDefined()` has been asked about, and the ones it rejected. It rejects at once a name that
// no definition can have, such as the `vue:row` of `<tr is="vue:row">`, so a name it has not rejected by the next task
// is one a definition can have.
const askedNames = new Set<string>();
const neverDefinedNames = new Set<string>();

/**
 * Whether a definition can have `name`, or `undefined` for a name not seen before, whose answer comes in the next task.
 */
function isDefinable(name: string): boolean | undefined {
  if (neverDefinedNames.has(name)) return false;
  if (askedNames.has(name)) return true;
  askedNames.add(name);
  customElements.whenDefined(name).catch(() => neverDefinedNames.add(name));
  return undefined;
}
