import type { ImpulseElement } from './element';

export default class Scope {
  constructor(private readonly instance: ImpulseElement) {}

  scopedTarget = (element: Element) => {
    return element.closest(this.identifier) === this.instance;
  };

  private get identifier() {
    return this.instance.identifier;
  }
}
