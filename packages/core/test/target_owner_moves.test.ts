import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import { ImpulseElement, registerElement, target, targets, whenInitialized } from '../src';
import { captureReportedErrors } from './support/capture_reported_errors';

// Seeded runs that move an Owner from inside one of its own target callbacks while changes are being delivered. The
// Owner is torn down and initializes again, its targets decided afresh, so a read made beforehand need not match what
// is delivered; `target_reads.test.ts` checks that agreement for Owners that stay put. What must hold once the changes
// have settled is checked instead: a `@target()` field is empty only when nothing claims it and otherwise holds a
// Claimant, a `@targets()` field holds exactly its Claimants in document order, and every callback is paired.
//
// The Owner is the only one on this page, so its move stops the shared token routers part-way through a delivery, and
// they start again as it initializes (#246).

@registerElement('target-owner-moves-test')
class TargetOwnerMovesTest extends ImpulseElement {
  @target() item: HTMLElement | null;
  @targets() items: HTMLElement[];
  // Connected minus disconnected callbacks per field and element.
  balance = new Map<string, number>();
  private callbacksBeforeMove = 0;

  /** Moves the Owner into its parent from inside the `count`th target callback from now. */
  moveFromCallback(count: number) {
    this.callbacksBeforeMove = count;
  }

  itemConnected(element: HTMLElement) {
    this.called(`item:${element.id}`, 1);
  }

  itemDisconnected(element: HTMLElement) {
    this.called(`item:${element.id}`, -1);
  }

  itemsConnected(element: HTMLElement) {
    this.called(`items:${element.id}`, 1);
  }

  itemsDisconnected(element: HTMLElement) {
    this.called(`items:${element.id}`, -1);
  }

  /** Counts a callback, then moves the Owner if it was asked to on this one. */
  private called(name: string, delta: number) {
    this.balance.set(name, (this.balance.get(name) ?? 0) + delta);
    if (this.callbacksBeforeMove > 0 && --this.callbacksBeforeMove === 0 && this.isConnected) {
      this.parentElement!.append(this);
    }
  }
}

const ITEM = 'target-owner-moves-test.item';
const ITEMS = 'target-owner-moves-test.items';
const DESCRIPTOR = `${ITEM} ${ITEMS}`;
// What a rewrite sets `data-target` to: nothing, the fields, or the fields listed twice.
const REWRITES = ['', DESCRIPTOR, `${DESCRIPTOR} ${DESCRIPTOR}`];
const SEEDS = 300;

function random(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

// The Owner's children that list `field` as the DOM stands, in document order.
function claimantsOf(owner: Element, field: string): HTMLElement[] {
  return Array.from(owner.querySelectorAll<HTMLElement>('[data-target]')).filter((element) =>
    (element.getAttribute('data-target') ?? '').split(/\s+/).includes(field),
  );
}

describe('target fields of an Owner moved from one of its callbacks', () => {
  let errors: ReturnType<typeof captureReportedErrors>;
  beforeEach(() => {
    // Runs that leave two Claimants for `item` are reported; that is not what is under test here.
    errors = captureReportedErrors('Multiple "item" targets');
  });
  afterEach(() => errors.release());

  for (let seed = 1; seed <= SEEDS; seed++) {
    it(`should hold its Claimants once the changes settle and leave every callback paired (seed ${seed})`, async () => {
      const next = random(seed);
      const host = await fixture<HTMLElement>(html`
        <div>
          <target-owner-moves-test>
            <div id="first" data-target=${DESCRIPTOR}></div>
            <div id="second" data-target=${DESCRIPTOR}></div>
          </target-owner-moves-test>
        </div>
      `);
      const owner = host.querySelector<TargetOwnerMovesTest>('target-owner-moves-test')!;
      await whenInitialized(owner);
      const any = <E>(list: E[]) => list[Math.floor(next() * list.length)];
      const steps: string[] = [];
      let inserted = 0;

      for (let round = 0; round < 3; round++) {
        const callbacks = 1 + Math.floor(next() * 3);
        owner.moveFromCallback(callbacks);
        steps.push(`move the Owner from callback ${callbacks}`);
        for (let count = 1 + Math.floor(next() * 5); count > 0; count--) {
          const children = Array.from(owner.querySelectorAll<HTMLElement>('[data-target]'));
          const element = any(children);
          const kind = Math.floor(next() * 5);
          if (kind === 0 || !element) {
            const fresh = document.createElement('div');
            fresh.id = `inserted-${inserted++}`;
            fresh.setAttribute('data-target', DESCRIPTOR);
            if (next() < 0.5) owner.prepend(fresh);
            else owner.append(fresh);
            steps.push(`insert ${fresh.id}`);
          } else if (kind === 1) {
            element.remove();
            steps.push(`remove ${element.id}`);
          } else if (kind === 2) {
            if (next() < 0.5) owner.prepend(element);
            else owner.append(element);
            steps.push(`move ${element.id}`);
          } else if (kind === 3) {
            element.setAttribute('data-target', any(REWRITES));
            steps.push(`set ${element.id}'s data-target to "${element.getAttribute('data-target')}"`);
          } else {
            const other = any(children);
            if (other && other !== element) {
              other.before(element);
              steps.push(`put ${element.id} before ${other.id}`);
            }
          }
        }
        if (next() < 0.3) await Promise.resolve();
        else await nextFrame();
      }
      owner.moveFromCallback(0);
      await nextFrame();
      await whenInitialized(owner);

      const story = steps.join('; ');
      const itemClaimants = claimantsOf(owner, ITEM);
      if (itemClaimants.length === 0) expect(owner.item, story).to.equal(null);
      else expect(itemClaimants, story).to.include(owner.item);
      expect(owner.items, story).to.deep.equal(claimantsOf(owner, ITEMS));
      const unpaired = Array.from(owner.balance).filter(([, balance]) => balance !== 0);
      const expected = [
        ...(owner.item ? [[`item:${owner.item.id}`, 1]] : []),
        ...owner.items.map((item) => [`items:${item.id}`, 1]),
      ];
      expect(unpaired.sort(), story).to.deep.equal(expected.sort());
    });
  }
});
