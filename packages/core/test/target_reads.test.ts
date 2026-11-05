import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import { ImpulseElement, registerElement, target, targets } from '../src';
import { captureReportedErrors } from './support/capture_reported_errors';

// A read made while DOM changes wait to be delivered works the fields out from the DOM, and delivery then updates the
// index the callbacks follow. The two have to agree whatever the changes were, and every callback has to be paired, so
// this runs seeded random runs of insertions, removals, moves (the Target's often), `data-target` rewrites and moves
// into a nested element of the same tag, all in one task.

@registerElement('target-reads-test')
class TargetReadsTest extends ImpulseElement {
  @target() item: HTMLElement | null;
  @targets() items: HTMLElement[];
  // Connected minus disconnected callbacks per field and element.
  balance = new Map<string, number>();

  itemConnected(element: HTMLElement) {
    this.count(`item:${element.id}`, 1);
  }

  itemDisconnected(element: HTMLElement) {
    this.count(`item:${element.id}`, -1);
  }

  itemsConnected(element: HTMLElement) {
    this.count(`items:${element.id}`, 1);
  }

  itemsDisconnected(element: HTMLElement) {
    this.count(`items:${element.id}`, -1);
  }

  private count(name: string, delta: number) {
    this.balance.set(name, (this.balance.get(name) ?? 0) + delta);
  }
}

const DESCRIPTOR = 'target-reads-test.item target-reads-test.items';
const SEEDS = 300;

function random(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

describe('target reads made before a change is delivered', () => {
  let errors: ReturnType<typeof captureReportedErrors>;
  beforeEach(() => {
    // Runs that leave two claimants for `item` are reported; that is not what is under test here.
    errors = captureReportedErrors('Multiple "item" targets');
  });
  afterEach(() => errors.release());

  for (let seed = 1; seed <= SEEDS; seed++) {
    it(`should agree with the delivered targets and leave every callback paired (seed ${seed})`, async () => {
      const next = random(seed);
      const el = await fixture<TargetReadsTest>(html`
        <target-reads-test>
          <div id="first" data-target=${DESCRIPTOR}></div>
          <section><target-reads-test id="nested"></target-reads-test></section>
        </target-reads-test>
      `);
      await nextFrame();

      const target = el.item;
      const places = [el, el.querySelector('section')!, el.querySelector('#nested')!];
      const any = <E>(list: E[]) => list[Math.floor(next() * list.length)];
      const claimant = () =>
        target && next() < 0.35 ? target : any(Array.from(el.querySelectorAll<HTMLElement>('[data-target]')));
      const steps: string[] = [];
      let inserted = 0;

      for (let count = 1 + Math.floor(next() * 7); count > 0; count--) {
        const kind = Math.floor(next() * 5);
        const element = claimant();
        const place = any(places);
        if (kind === 0 || !element) {
          const fresh = document.createElement('div');
          fresh.id = `inserted-${inserted++}`;
          fresh.setAttribute('data-target', DESCRIPTOR);
          if (next() < 0.5) place.prepend(fresh);
          else place.append(fresh);
          steps.push(`insert ${fresh.id} into ${place.id || place.localName}`);
        } else if (kind === 1) {
          element.remove();
          steps.push(`remove ${element.id}`);
        } else if (kind === 2) {
          if (next() < 0.5) place.prepend(element);
          else place.append(element);
          steps.push(`move ${element.id} into ${place.id || place.localName}`);
        } else if (kind === 3) {
          element.setAttribute('data-target', next() < 0.5 ? '' : DESCRIPTOR);
          steps.push(`set ${element.id}'s data-target to "${element.getAttribute('data-target')}"`);
        } else {
          const other = claimant();
          if (other && other !== element && !element.contains(other)) {
            other.before(element);
            steps.push(`put ${element.id} before ${other.id}`);
          }
        }
      }

      const read = { item: el.item?.id ?? null, items: el.items.map((item) => item.id) };
      await nextFrame();
      const delivered = { item: el.item?.id ?? null, items: el.items.map((item) => item.id) };
      const unpaired = Array.from(el.balance).filter(([, balance]) => balance !== 0);
      const expected = [
        ...(delivered.item ? [[`item:${delivered.item}`, 1]] : []),
        ...delivered.items.map((id) => [`items:${id}`, 1]),
      ];

      const story = steps.join('; ');
      expect(read, story).to.deep.equal(delivered);
      expect(unpaired.sort(), story).to.deep.equal(expected.sort());
    });
  }
});
