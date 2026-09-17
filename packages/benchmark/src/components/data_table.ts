import { ImpulseElement, registerElement, targets } from '@ambiki/impulse';

@registerElement('data-table')
export class DataTableElement extends ImpulseElement {
  @targets() labels: HTMLElement[];
  @targets() deleteButtons: HTMLElement[];

  selectedId: string | null = null;

  select(event: Event) {
    this.selectedId = (event.currentTarget as HTMLElement).dataset.id ?? null;
  }

  navigate() {
    // Present so the keydown token wires a listener; no keys are pressed during a benchmark.
  }
}
