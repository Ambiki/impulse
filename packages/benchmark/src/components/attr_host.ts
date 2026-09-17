import { ImpulseElement, registerElement } from '@ambiki/impulse';

@registerElement('attr-host')
export class AttrHostElement extends ImpulseElement {
  pokes = 0;

  poke() {
    this.pokes += 1;
  }
}
