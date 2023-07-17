import { ImpulseElement, registerElement } from '@ambiki/impulse';

@registerElement('parent-container')
export default class ParentContainerElement extends ImpulseElement {
  toggle(event: Event) {
    console.log({ event, instance: this });
  }
}
