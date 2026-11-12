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

  it('should upgrade the elements already in the page once the class is complete', () => {
    const existing = document.createElement('register-element-upgrade-test');
    existing.setAttribute('size', 'large');
    document.body.append(existing);

    try {
      @registerElement('register-element-upgrade-test')
      class UpgradeTest extends ImpulseElement {
        static sizes = ['small', 'large'];
        // Read while the element is upgraded, which is when `customElements.define()` runs.
        sizesWhenConstructed = (this.constructor as typeof UpgradeTest).sizes;
        @property() size = 'small';
      }

      const upgraded = existing as UpgradeTest;
      expect(upgraded).to.be.instanceOf(UpgradeTest);
      expect(upgraded.sizesWhenConstructed).to.deep.equal(['small', 'large']);
      expect(UpgradeTest.observedAttributes).to.deep.equal(['size']);
      expect(upgraded.size).to.equal('large');
    } finally {
      existing.remove();
    }
  });
});
