import { ImpulseElement, property, registerElement, targets } from '@ambiki/impulse';

@registerElement('slide-show')
export default class SlideShowElement extends ImpulseElement {
  @property({ type: Number }) activeIndex: number;
  @property({ type: Number }) autoPlay = 0;

  @targets() slides: HTMLElement[];

  connected() {
    // console.log(this.activeIndex);
  }

  slidesConnected(element: HTMLElement) {
    console.log({ element });
  }

  // slidesDisconnected(element: HTMLElement) {
  //   console.log({ element, slides: this.slides });
  // }
}
