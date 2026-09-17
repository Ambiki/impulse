import type { Scenario } from './scenario.ts';
import { expectEqual, fixture, range, STARTED_ATTRIBUTE } from './fixtures.ts';

const ITEMS = 1_000;

interface AttrHost extends HTMLElement {
  pokes: number;
}

function host(): AttrHost {
  return document.querySelector('attr-host') as AttrHost;
}

function item(index: number, attributes = ''): string {
  return `<div class="item"${attributes}><span>Item ${index}</span></div>`;
}

/**
 * A class toggle and an inline style write on each of 1,000 elements, in one task: 2,000 attribute mutation records
 * for Impulse's document observer, none of them on an attribute Impulse reads. `page` decides whether the elements
 * carry tokens; either way a started component is on the page, so the observer is running.
 */
function attributeScenario(
  name: string,
  description: string,
  page: () => DocumentFragment,
  verifyItems: (items: HTMLElement[]) => string[],
): Scenario {
  let items: HTMLElement[];
  let offset = 0;

  return {
    name,
    description,
    warmup: 5,
    measured: 10,
    setup() {
      document.body.replaceChildren(page());
      items = Array.from(document.querySelectorAll<HTMLElement>('.item'));
    },
    run() {
      offset += 1;
      for (const element of items) {
        element.classList.toggle('is-active');
        element.style.transform = `translateX(${offset}px)`;
      }
    },
    teardown() {
      document.body.replaceChildren();
    },
    verify() {
      const problems: string[] = [];
      expectEqual(problems, '<attr-host> started', host().hasAttribute(STARTED_ATTRIBUTE), true);
      const unchanged = items.filter(
        (element) => !element.classList.contains('is-active') || element.style.transform !== `translateX(${offset}px)`,
      );
      expectEqual(problems, 'items `run` did not change', unchanged.length, 0);
      return [...problems, ...verifyItems(items)];
    },
  };
}

/** The mutated elements carry no tokens and sit outside the component. */
export const attributesPlain = attributeScenario(
  'attributes-plain',
  'Times toggling a class and writing an inline style on 1,000 elements that carry no Impulse tokens, in one task. A ' +
  'component elsewhere on the page keeps Impulse\'s document observer running, so this is the cost Impulse adds to DOM ' +
  'work it has nothing to do with.',
  fixture(
    () =>
      `<attr-host><button type="button" data-action="click->attr-host#poke">Poke</button></attr-host>` +
      `<div class="list">${range(1, ITEMS).map((index) => item(index)).join('')}</div>`,
  ),
  () => {
    const problems: string[] = [];
    host().querySelector('button')!.click();
    expectEqual(problems, 'pokes after clicking the button', host().pokes, 1);
    return problems;
  },
);

/** The mutated elements each carry a `data-action` token, so the observer matches them and then ignores the change. */
export const attributesTokened = attributeScenario(
  'attributes-tokened',
  'Like attributes-plain, but each of the 1,000 elements carries a data-action token, so Impulse\'s observer matches ' +
  'every changed element before ignoring the class and style changes.',
  fixture(
    () =>
      `<attr-host><div class="list">` +
      `${range(1, ITEMS).map((index) => item(index, ' data-action="click->attr-host#poke"')).join('')}` +
      `</div></attr-host>`,
  ),
  (items) => {
    const problems: string[] = [];
    items[ITEMS / 2].click();
    expectEqual(problems, 'pokes after clicking an item', host().pokes, 1);
    return problems;
  },
);
