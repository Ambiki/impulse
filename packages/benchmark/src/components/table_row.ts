import { ImpulseElement, property, registerElement, target } from '@ambiki/impulse';

@registerElement('table-row')
export class TableRowElement extends ImpulseElement {
  @property({ type: Boolean }) selected = false;
  @target() label: HTMLElement;
  @target() deleteButton: HTMLElement;

  select() {
    this.selected = true;
  }

  navigate() {
    // Present so the keydown token wires a listener; no keys are pressed during a benchmark.
  }
}
