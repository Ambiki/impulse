import { expect } from '@open-wc/testing';
import { ImpulseElement, property, registerElement } from '../src';

describe('@registerElement', () => {
  it('should register a class that keeps the name and type of the decorated one', () => {
    @registerElement('register-element-name-test')
    class NameTest extends ImpulseElement {}

    const element = document.createElement('register-element-name-test');
    expect(element).to.be.instanceOf(NameTest);
    expect(NameTest.name).to.equal('NameTest');
  });

  it('should keep the first class when the tag name is registered again', () => {
    @registerElement('register-element-reload-test')
    class FirstTest extends ImpulseElement {
      @property() name = 'first';
    }

    @registerElement('register-element-reload-test')
    class SecondTest extends ImpulseElement {
      @property() name = 'second';
    }

    const element = document.createElement('register-element-reload-test') as FirstTest;
    expect(element).to.be.instanceOf(FirstTest);
    expect(element).not.to.be.instanceOf(SecondTest);
    expect(element).to.have.property('name', 'first');
  });
});
