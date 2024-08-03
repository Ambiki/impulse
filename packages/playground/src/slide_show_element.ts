import { ImpulseElement, property, registerElement, targets } from '@ambiki/impulse';

@registerElement('slide-show')
export default class SlideShowElement extends ImpulseElement {
  @property({ type: Number }) activeIndex: number;
  @property({ type: Number }) autoPlay = 0;

  @targets() slides: HTMLElement[];

  connected() {
    console.log('connected', this.slides);
  }

  slidesConnected(element: HTMLElement) {
    console.log('slidesConnected', element);
    console.log('slidesConnectedThis', this);
  }

  // slidesDisconnected(element: HTMLElement) {
  //   console.log({ element, slides: this.slides });
  // }
}
