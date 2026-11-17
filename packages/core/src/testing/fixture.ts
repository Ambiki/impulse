import { whenSettled } from './settled';

// The container of every fixture not yet removed.
const containers = new Set<HTMLElement>();

/**
 * Puts `html` in a `<div>` of its own on `<body>`, and resolves with its first element once the document is Settled
 * (see {@link whenSettled}). The `<div>` is removed by `cleanup()`, which runs after each test.
 *
 * @param html - The markup, as a string. Text and comments before its first element are skipped.
 * @param options - Optional settings.
 * @param options.timeout - Milliseconds to wait for the document to be Settled before rejecting, 1000 by default.
 * @returns A promise that resolves with the first element of the markup.
 * @throws A `TypeError` for anything but a string, and an `Error` for markup that holds no element; either way, nothing is
 * added to the document.
 *
 * @example
 * ```ts
 * const item = await fixture<AccordionItemElement>(`
 *   <accordion-item>
 *     <button data-target="accordion-item.toggleButton">Options</button>
 *   </accordion-item>
 * `);
 * ```
 */
export async function fixture<T extends Element = Element>(
  html: string,
  { timeout }: { timeout?: number } = {},
): Promise<T> {
  if (typeof html !== 'string') {
    throw new TypeError(`fixture() takes the markup as a string, not ${html === null ? 'null' : typeof html}.`);
  }
  const container = document.createElement('div');
  container.innerHTML = html;
  const element = container.firstElementChild;
  if (!element) throw new Error(`fixture() was given markup with no element: ${JSON.stringify(html)}.`);

  containers.add(container);
  document.body.append(container);
  await whenSettled({ timeout });
  return element as T;
}

/** Removes every fixture from the document. */
export function removeFixtures() {
  for (const container of containers) container.remove();
  containers.clear();
}
