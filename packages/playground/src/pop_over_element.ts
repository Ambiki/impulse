import { ImpulseElement, registerElement, target } from '@ambiki/impulse';

@registerElement('pop-over')
export default class PopOverElement extends ImpulseElement {
  // @property({ type: Boolean }) open = true;

  @target() panel: HTMLElement;

  connected() {
    // console.log(this.open);
    // const targets = (Object.getPrototypeOf(this).constructor as typeof ImpulseElement).targets;
    // console.log({ element: this, targets, panel: this.panel });
  }

  panelConnected(panel: HTMLElement) {
    console.log({ panel, element: this });
  }

  panelDisconnected(panel: HTMLElement) {
    console.log({ panel, element: this });
  }
}
