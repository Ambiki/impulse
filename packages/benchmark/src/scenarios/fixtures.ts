/** Set by `ImpulseElement` once a component has started its properties, targets and actions. */
export const STARTED_ATTRIBUTE = 'data-impulse-element';

/**
 * Parses `html` once, on first use, and returns a function producing fresh copies of it. The copies belong to the
 * template's inert document, so custom elements inside them are constructed and upgraded when they are inserted into
 * the page, inside the timed operation, as they would be for server-rendered HTML arriving over the wire.
 */
export function fixture(html: () => string): () => DocumentFragment {
  let template: HTMLTemplateElement | undefined;
  return () => {
    if (!template) {
      template = document.createElement('template');
      template.innerHTML = html();
    }
    return template.content.cloneNode(true) as DocumentFragment;
  };
}

/** How many of `elements` have finished starting (or, once removed, have not yet been torn down). */
export function startedCount(elements: Element[]): number {
  return elements.filter((element) => element.hasAttribute(STARTED_ATTRIBUTE)).length;
}

export function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

/** Collects a problem when `actual` is not `expected`. */
export function expectEqual(problems: string[], label: string, actual: unknown, expected: unknown) {
  if (actual !== expected) problems.push(`${label}: expected ${String(expected)}, got ${String(actual)}`);
}
