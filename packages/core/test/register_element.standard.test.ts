import { expect, fixture, html } from '@open-wc/testing';
import { ImpulseElement, property, registerElement, target, whenInitialized } from '../src';

// A class decorator with the standard signature, so only the standard profiles compile this file.
function wrapped<T extends abstract new (...args: any[]) => object>(ctor: T, _context: ClassDecoratorContext): T {
  abstract class Wrapped extends ctor {}
  return Wrapped as T;
}

describe('@registerElement with standard decorators', () => {
  it('keeps the Declarations when another class decorator replaces the class it returns', async () => {
    @wrapped
    @registerElement('register-element-wrapped-test')
    class WrappedTest extends ImpulseElement {
      @property() placeholder = '';
      @target() label: HTMLElement | null;
    }

    const element = await fixture<WrappedTest>(html`
      <register-element-wrapped-test placeholder="Name">
        <label data-target="register-element-wrapped-test.label"></label>
      </register-element-wrapped-test>
    `);
    await whenInitialized(element);

    const registered = customElements.get('register-element-wrapped-test') as unknown as typeof ImpulseElement;
    expect(registered.observedAttributes).to.deep.eq(['placeholder']);
    expect(element.placeholder).to.eq('Name');
    expect(element.label).to.eq(element.querySelector('label'));
  });
});
