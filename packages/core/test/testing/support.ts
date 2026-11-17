import { ImpulseElement } from '../../src';

// These tests also run in jsdom, against the published build (see jest.config.cjs), so they import nothing that a
// browser alone provides: no `@open-wc/testing` helper other than `expect`.

let count = 0;

/** A tag name no other test on the page has used. The custom element registry is shared by every test on the page. */
export function uniqueTag(name: string): string {
  count += 1;
  return `${name}-${count}`;
}

/** Defines an Impulse element under a new tag, made from `name`, and returns the tag. */
export function defineImpulseElement(name: string, ctor: CustomElementConstructor = class extends ImpulseElement {}) {
  const tag = uniqueTag(name);
  customElements.define(tag, ctor);
  return tag;
}

/** The error `promise` rejects with. Fails if it fulfills instead. */
export async function rejectionOf(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }
  throw new Error('Expected the promise to reject, but it fulfilled.');
}

const appended: Element[] = [];

/**
 * Puts `html` in a `<div>` appended to `<body>`, and returns the `<div>`'s first element. Unlike `fixture()`, it waits
 * for nothing, so a test of a wait can start from a document that is not Settled. The `<div>` is removed by
 * {@link removeAppended}.
 */
export function appendMarkup<T extends Element = Element>(html: string): T {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.append(container);
  appended.push(container);
  return container.firstElementChild as T;
}

export function removeAppended() {
  for (const container of appended.splice(0)) container.remove();
}
