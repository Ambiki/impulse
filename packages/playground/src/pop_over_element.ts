import { ImpulseElement, property, registerElement, target } from '@ambiki/impulse';

@registerElement('pop-over')
export default class PopOverElement extends ImpulseElement {
  @property() placement: string;
  @property({ type: Number }) delay: number;
  @property({ type: Boolean }) fallback: boolean;

  @target() panel: HTMLElement;

  connected() {
    console.log('connected: ', this.panel);
  }

  disconnected() {
    console.log('disconnected: ', this.panel);
  }

  panelConnected(panel: HTMLElement) {
    console.log('panel connected: ', panel);
  }

  async panelDisconnected(panel: HTMLElement) {
    console.log('panel disconnected: ', panel);
    console.log({ thisPanel: this.panel });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    console.log('next tick this.panel disconnected: ', this.panel);
  }
}
