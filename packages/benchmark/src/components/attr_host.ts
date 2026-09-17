import { ImpulseElement, lazyImport, registerElement } from '@ambiki/impulse';

@registerElement('attr-host')
export class AttrHostElement extends ImpulseElement {
  pokes = 0;

  poke() {
    this.pokes += 1;
  }
}

let fallbackRegistered = false;

/**
 * Registers a lazy import whose selector is not a self-contained selector (it has a combinator) and never matches, so
 * Impulse's document observer has to deliver every attribute change for as long as the page lives. Registered once per
 * page, since `lazyImport` has no way to stop it.
 */
@registerElement('fallback-host')
export class FallbackHostElement extends ImpulseElement {
  connected() {
    if (fallbackRegistered) return;
    fallbackRegistered = true;
    lazyImport('.list .never-present', () => {});
  }
}
