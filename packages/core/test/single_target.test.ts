import type { SingleTarget, SingleTargetHost } from '../src/single_target';
import { expect } from '@open-wc/testing';
import { createSingleTarget } from '../src/single_target';
import { captureReportedErrors } from './support/capture_reported_errors';

// The rule a `@target()` field follows, driven directly: the test says which elements claim the field as the DOM
// stands, reports each claim and release as `Target` would, starts each delivery and ends the run itself. The elements
// are real, so document order is the DOM's.
describe('createSingleTarget', () => {
  interface Scene {
    field: SingleTarget<HTMLElement>;
    log: string[];
    /** The elements that claim the field as the DOM stands. */
    claiming: Set<HTMLElement>;
    /** Elements `a` to `e`, in document order. */
    el: Record<'a' | 'b' | 'c' | 'd' | 'e', HTMLElement>;
    /** Runs `run` as one delivery: everything it claims and releases shares a delivery number. */
    deliver: (run: () => void) => void;
    /** Ends the run of deliveries, running what was left for after it, as the microtasks queued in it would. */
    endRun: () => void;
    /** Whether the Owner is subscribed. */
    active: boolean;
  }

  interface Callbacks {
    connected?: (element: HTMLElement) => void;
    disconnected?: (element: HTMLElement) => void;
  }

  const roots: HTMLElement[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) root.remove();
  });

  function scene(callbacks: Callbacks = {}): Scene {
    const root = document.createElement('div');
    root.innerHTML = '<p id="a"></p><p id="b"></p><p id="c"></p><p id="d"></p><p id="e"></p>';
    document.body.append(root);
    roots.push(root);
    const el = Object.fromEntries(Array.from(root.children, (child) => [child.id, child])) as Scene['el'];
    const log: string[] = [];
    const claiming = new Set<HTMLElement>();
    const queued: Array<() => void> = [];
    let deliveries = 0;
    let delivering = false;

    const deliver = (run: () => void) => {
      const nested = delivering;
      if (!nested) deliveries += 1;
      delivering = true;
      try {
        run();
      } finally {
        delivering = nested;
      }
    };

    const state = {} as Scene;
    const host: SingleTargetHost<HTMLElement> = {
      claims: (_key, element) => claiming.has(element),
      claimants: () => Array.from(root.children as HTMLCollectionOf<HTMLElement>).filter((child) => claiming.has(child)),
      connected: (_key, element) => {
        log.push(`connected ${element.id}`);
        callbacks.connected?.(element);
      },
      disconnected: (_key, element) => {
        log.push(`disconnected ${element.id}`);
        callbacks.disconnected?.(element);
      },
      reportMultiple: () => log.push('multiple'),
      active: () => state.active,
      clock: () => (delivering ? deliveries : 0),
      afterRun: (task) => queued.push(task),
      deliver,
    };

    Object.assign(state, {
      field: createSingleTarget(host, 'panel'),
      log,
      claiming,
      el,
      deliver,
      endRun: () => {
        while (queued.length > 0) queued.shift()!();
      },
      active: true,
    });
    return state;
  }

  /** Claims the field for `element` in a delivery of its own, and ends the run. */
  function claimAlone(s: Scene, element: HTMLElement) {
    s.claiming.add(element);
    s.deliver(() => s.field.claim(element));
    s.endRun();
  }

  it('connects the first Claimant and disconnects it once it is released', () => {
    const s = scene();
    claimAlone(s, s.el.a);
    expect(s.field.target).to.eq(s.el.a);

    s.claiming.delete(s.el.a);
    s.deliver(() => s.field.release(s.el.a));
    expect(s.log).to.deep.eq(['connected a', 'disconnected a']);
    expect(s.field.target).to.eq(null);
  });

  it('keeps a second Claimant waiting, and reports it when it is still there once the run is over', () => {
    const s = scene();
    claimAlone(s, s.el.b);
    s.claiming.add(s.el.c);
    s.deliver(() => s.field.claim(s.el.c));
    expect(s.field.target).to.eq(s.el.b);
    expect(s.log).to.deep.eq(['connected b']);

    s.endRun();
    expect(s.log).to.deep.eq(['connected b', 'multiple']);
  });

  it('reports a Claimant once in a run, however often it starts waiting in it', () => {
    const s = scene();
    claimAlone(s, s.el.c);
    s.claiming.add(s.el.d);
    s.claiming.add(s.el.b);
    // `d` waits, is moved and waits again, then is adopted when `c` leaves and displaced by `b` ahead of it.
    s.deliver(() => {
      s.field.claim(s.el.d);
      s.field.release(s.el.d);
      s.field.claim(s.el.d);
      s.claiming.delete(s.el.c);
      s.field.release(s.el.c);
      s.field.claim(s.el.b);
    });
    s.endRun();
    expect(s.field.target).to.eq(s.el.b);
    expect(s.log.filter((entry) => entry === 'multiple')).to.have.length(1);
  });

  it('adopts a waiting Claimant when the Target is released', () => {
    const s = scene();
    claimAlone(s, s.el.b);
    claimAlone(s, s.el.c);

    s.claiming.delete(s.el.b);
    s.deliver(() => s.field.release(s.el.b));
    expect(s.log).to.deep.eq(['connected b', 'multiple', 'disconnected b', 'connected c']);
    expect(s.field.target).to.eq(s.el.c);
  });

  it('reports nothing when a replacement arrives and the Target leaves in one run', () => {
    const s = scene();
    claimAlone(s, s.el.b);
    s.claiming.add(s.el.c);
    s.claiming.delete(s.el.b);
    s.deliver(() => {
      s.field.claim(s.el.c);
      s.field.release(s.el.b);
    });
    s.endRun();
    expect(s.log).to.deep.eq(['connected b', 'disconnected b', 'connected c']);
  });

  it('adopts the first waiting Claimant in document order', () => {
    const s = scene();
    claimAlone(s, s.el.a);
    claimAlone(s, s.el.d);
    claimAlone(s, s.el.c);

    s.claiming.delete(s.el.a);
    s.deliver(() => s.field.release(s.el.a));
    expect(s.field.target).to.eq(s.el.c);
  });

  it('forgets a waiting Claimant once it is released', () => {
    const s = scene();
    claimAlone(s, s.el.b);
    claimAlone(s, s.el.c);
    s.claiming.delete(s.el.c);
    s.deliver(() => s.field.release(s.el.c));

    s.claiming.delete(s.el.b);
    s.deliver(() => s.field.release(s.el.b));
    s.endRun();
    expect(s.field.target).to.eq(null);
    expect(s.log).to.deep.eq(['connected b', 'multiple', 'disconnected b']);
  });

  it('gives the field to a Claimant ahead of a Target that got it earlier in the same delivery', () => {
    const s = scene();
    s.claiming.add(s.el.c).add(s.el.b);
    s.deliver(() => {
      s.field.claim(s.el.c);
      s.field.claim(s.el.b);
    });
    expect(s.log).to.deep.eq(['connected c', 'disconnected c', 'connected b']);
    expect(s.field.target).to.eq(s.el.b);

    s.endRun();
    expect(s.log.at(-1)).to.eq('multiple');
  });

  it('reports nothing when the Target a takeover displaced leaves in the same run', () => {
    const s = scene();
    claimAlone(s, s.el.a);
    s.claiming.delete(s.el.a);
    s.claiming.add(s.el.c).add(s.el.b);
    s.deliver(() => {
      s.field.release(s.el.a);
      s.field.claim(s.el.c);
      s.field.claim(s.el.b);
      s.claiming.delete(s.el.c);
      s.field.release(s.el.c);
    });
    s.endRun();
    expect(s.field.target).to.eq(s.el.b);
    expect(s.log).to.deep.eq(['connected a', 'disconnected a', 'connected c', 'disconnected c', 'connected b']);
  });

  it('keeps the field for a Target that held it before this delivery when a Claimant ahead of it arrives', () => {
    const s = scene();
    claimAlone(s, s.el.c);
    s.claiming.add(s.el.b);
    s.deliver(() => s.field.claim(s.el.b));
    expect(s.field.target).to.eq(s.el.c);
    expect(s.log).to.deep.eq(['connected c']);
  });

  it('keeps the field for a moved Target, as held since before, while a Claimant matched in between waits', () => {
    const s = scene();
    claimAlone(s, s.el.c);
    s.claiming.add(s.el.a);
    // `c` is moved: its token is unmatched and matched again in the delivery, and claims the field throughout.
    s.deliver(() => {
      s.field.release(s.el.c);
      s.field.claim(s.el.a);
      s.field.claim(s.el.c);
    });
    expect(s.field.target).to.eq(s.el.c);
    expect(s.log).to.deep.eq(['connected c', 'disconnected c', 'connected c']);

    s.endRun();
    expect(s.log.at(-1)).to.eq('multiple');
  });

  it('counts a moved Target as holding the field since before the move, so a Claimant ahead of it does not take over', () => {
    const s = scene();
    claimAlone(s, s.el.c);
    s.claiming.add(s.el.b);
    s.deliver(() => {
      s.field.release(s.el.c);
      s.field.claim(s.el.c);
      s.field.claim(s.el.b);
    });
    expect(s.field.target).to.eq(s.el.c);
    expect(s.log).to.deep.eq(['connected c', 'disconnected c', 'connected c']);
  });

  it('does not adopt a waiting Claimant when the Target released still claims the field, having been moved', () => {
    const s = scene();
    claimAlone(s, s.el.c);
    claimAlone(s, s.el.b);
    s.deliver(() => {
      s.field.release(s.el.c);
      s.field.claim(s.el.c);
    });
    expect(s.field.target).to.eq(s.el.c);
    expect(s.log).to.deep.eq(['connected c', 'multiple', 'disconnected c', 'connected c']);
  });

  it('adopts a waiting Claimant once the run is over when a moved Target does not come back', () => {
    const s = scene();
    claimAlone(s, s.el.c);
    s.claiming.add(s.el.a);
    s.deliver(() => {
      s.field.release(s.el.c);
      s.field.claim(s.el.a);
    });
    expect(s.field.target).to.eq(null);

    s.claiming.delete(s.el.c);
    s.endRun();
    expect(s.field.target).to.eq(s.el.a);
  });

  it('does not adopt a waiting Claimant that no longer claims the field, and looks again once the run is over', () => {
    const s = scene();
    claimAlone(s, s.el.b);
    claimAlone(s, s.el.c);

    // `c` is removed in the same run as `b`, its release still to come.
    s.claiming.delete(s.el.b);
    s.claiming.delete(s.el.c);
    s.deliver(() => s.field.release(s.el.b));
    expect(s.field.target).to.eq(null);

    // A callback put `c`'s token back before its release was delivered, so no release comes.
    s.claiming.add(s.el.c);
    s.endRun();
    expect(s.field.target).to.eq(s.el.c);
  });

  it('does not adopt while the Owner is torn down', () => {
    const s = scene();
    claimAlone(s, s.el.b);
    claimAlone(s, s.el.c);
    s.active = false;
    // `b` no longer claims the field, so nothing but the teardown keeps `c` from being adopted.
    s.claiming.delete(s.el.b);
    s.deliver(() => {
      s.field.release(s.el.b);
      s.field.release(s.el.c);
    });
    s.endRun();
    expect(s.log).to.deep.eq(['connected b', 'multiple', 'disconnected b']);
    expect(s.field.target).to.eq(null);
  });

  it('does not connect the Claimant taking over when the Target\'s disconnected callback tears the Owner down', () => {
    const s = scene({
      disconnected: () => {
        s.active = false;
      },
    });
    s.claiming.add(s.el.c).add(s.el.b);
    s.deliver(() => {
      s.field.claim(s.el.c);
      s.field.claim(s.el.b);
    });
    expect(s.log).to.deep.eq(['connected c', 'disconnected c']);
    expect(s.field.target).to.eq(null);
  });

  it('rethrows a disconnected callback\'s error and reports a connected callback\'s, on either side of a takeover', () => {
    const reported = captureReportedErrors('connected failed');
    try {
      const s = scene({
        connected: (element) => {
          if (element.id === 'b') throw new Error('connected failed');
        },
        disconnected: () => {
          throw new Error('disconnected failed');
        },
      });
      s.claiming.add(s.el.c).add(s.el.b);
      expect(() =>
        s.deliver(() => {
          s.field.claim(s.el.c);
          s.field.claim(s.el.b);
        }),
      ).to.throw('disconnected failed');
      expect(s.field.target).to.eq(s.el.b);
      expect(reported.reported.map((error) => error.message)).to.deep.eq(['connected failed']);
    } finally {
      reported.release();
    }
  });

  it('rethrows a disconnected callback\'s error and reports a connected callback\'s, on either side of an adoption', () => {
    const reported = captureReportedErrors('connected failed');
    try {
      const s = scene({
        connected: (element) => {
          if (element.id === 'c') throw new Error('connected failed');
        },
        disconnected: () => {
          throw new Error('disconnected failed');
        },
      });
      claimAlone(s, s.el.b);
      claimAlone(s, s.el.c);
      s.claiming.delete(s.el.b);
      expect(() => s.deliver(() => s.field.release(s.el.b))).to.throw('disconnected failed');
      expect(s.field.target).to.eq(s.el.c);
      expect(reported.reported.map((error) => error.message)).to.deep.eq(['connected failed']);
    } finally {
      reported.release();
    }
  });

  it('reads the Target while it claims the field, and otherwise the first Claimant in document order', () => {
    const s = scene();
    expect(s.field.now()).to.eq(null);
    claimAlone(s, s.el.c);
    s.claiming.add(s.el.a);
    expect(s.field.now()).to.eq(s.el.c);

    s.claiming.delete(s.el.c);
    expect(s.field.now()).to.eq(s.el.a);
    expect(s.field.target).to.eq(s.el.c);
  });

  it('forgets the Target it had once reset, so a claim after it is not taken for that Target moving', () => {
    const s = scene();
    claimAlone(s, s.el.c);
    s.claiming.add(s.el.a);
    // The Owner is torn down and starts again within one delivery, `c` claiming the field throughout. Remembered, `c`
    // leaving would read as a move, so `a` would wait for it and `c` would get the field back.
    s.deliver(() => {
      s.active = false;
      s.field.release(s.el.c);
      s.field.reset();
      s.active = true;
      s.field.claim(s.el.a);
      s.field.claim(s.el.c);
    });
    expect(s.field.target).to.eq(s.el.a);
  });
});
