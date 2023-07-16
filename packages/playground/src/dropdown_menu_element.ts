import { ImpulseElement, registerElement, targets } from '@ambiki/impulse';

@registerElement('dropdown-menu')
export default class DropdownMenuElement extends ImpulseElement {
  @targets() items: HTMLElement[];

  connected(): void {
    console.log(this.items);
  }

  disconnected() {
    console.log(this.items);
  }

  itemsConnected(item: HTMLElement) {
    console.log('item connected: ', item);
  }

  async itemsDisconnected(item: HTMLElement) {
    console.log('item disconnected: ', item);
    console.log({ thisItems: this.items });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    console.log('next tick this.items disconnected: ', this.items);
  }

  sheetsDisconnected() {
    console.log('sheets disconnected');
  }
}
