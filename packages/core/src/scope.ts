import type ImpulseElement from './element';

export default class Scope {
  constructor(private readonly instance: ImpulseElement) {
    this.instance = instance;
  }

  findTarget(selector: string): Element | null {
    return this.instance.matches(selector) ? this.instance : this.getElements(selector).find(this.scopedTarget) || null;
  }

  findTargets(selector: string): Element[] {
    return [
      ...(this.instance.matches(selector) ? [this.instance] : []),
      ...this.getElements(selector).filter(this.scopedTarget),
    ];
  }

  scopedTarget = (element: Element) => {
    return element.closest(this.identifier) === this.instance;
  };

  private getElements(selector: string): Element[] {
    return Array.from(this.instance.querySelectorAll(selector));
  }

  private get identifier() {
    return this.instance.identifier;
  }
}
