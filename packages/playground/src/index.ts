import { ImpulseElement, property, registerElement } from '@ambiki/impulse';
import './style.css';

@registerElement('pop-over')
export default class PopOverElement extends ImpulseElement {
  @property() placement: string;
  @property({ type: Number }) delay: number;
  @property({ type: Boolean }) fallback: boolean;

  connected() {
    console.log({ placement: this.placement });
    console.log({ delay: this.delay });
    console.log({ fallback: this.fallback });
  }
}
