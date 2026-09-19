import { ImpulseElement, lazyImport, registerElement } from '@ambiki/impulse';

let registered = 0;

/**
 * Registers `count` lazy imports whose selectors never match, so the shared document observer carries that many extra
 * watchers for the life of the page on top of the `[data-target]` and `[data-action]` it always has.
 *
 * Every enumeration of an added or removed subtree has to account for all of them, so the number of registered
 * selectors is its own performance axis - one the other Scenarios never vary, since they run with only the two
 * selectors Impulse registers for itself. Registered once per page, since `lazyImport` has no way to stop it.
 */
@registerElement('watcher-host')
export class WatcherHostElement extends ImpulseElement {
  connected() {
    const count = Number(this.getAttribute('count') ?? 0);
    for (let index = registered; index < count; index += 1) {
      lazyImport(`[data-js-load-${index}]`, () => {});
    }
    registered = Math.max(registered, count);
  }
}
