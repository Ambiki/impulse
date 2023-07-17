import { ImpulseElement, property, registerElement, target } from '@ambiki/impulse';

@registerElement('pop-over')
export default class PopOverElement extends ImpulseElement {
  @property() placement: string;
  @property({ type: Number }) delay: number;
  @property({ type: Boolean }) fallback: boolean = true;

  @target() panel: HTMLElement;

  toggle(event: Event) {
    console.log({ event, instance: this });
  }

  // connected() {
  //   console.log('connected: ', this.panel);
  // }
  //
  // disconnected() {
  //   console.log('disconnected: ', this.panel);
  // }
  //
  // panelConnected(panel: HTMLElement) {
  //   console.log('panel connected: ', panel);
  // }
  //
  // async panelDisconnected(panel: HTMLElement) {
  //   console.log('panel disconnected: ', panel);
  //   console.log({ thisPanel: this.panel });
  //   await new Promise((resolve) => requestAnimationFrame(resolve));
  //   console.log('next tick this.panel disconnected: ', this.panel);
  // }
  //
  // placementChanged(newValue: string, oldValue: string) {
  //   console.log('placement changed: ', { newValue, oldValue });
  // }
  //
  // delayChanged(newValue: number, oldValue: number) {
  //   console.log('delay changed: ', { newValue, oldValue });
  // }
  //
  // fallbackChanged(newValue: boolean, oldValue: boolean) {
  //   console.log('fallback changed: ', { newValue, oldValue });
  // }
}
