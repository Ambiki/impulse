import { fixture, html, expect } from '@open-wc/testing';
import { ImpulseElement, registerElement, property } from '../src';

describe('@property', () => {
  it('initializes the property', async () => {
    @registerElement('property-initialize-test')
    class PropertyTest extends ImpulseElement {
      // From HTML
      @property() placement: string;
      @property({ type: Boolean }) fallback: boolean;
      @property({ type: Number }) delay: number;

      // Default value
      @property() name = 'foo';
      @property({ type: Boolean }) persisted = false;
      @property({ type: Boolean }) newRecord = true;
      @property({ type: Number }) age = 0;
      @property({ type: Number }) session = 12;
    }

    const el: PropertyTest = await fixture(
      html`<property-initialize-test placement="bottom" fallback delay="0"></property-initialize-test>`
    );

    expect(el).to.have.property('placement', 'bottom');
    expect(el).to.have.attribute('placement', 'bottom');

    expect(el).to.have.property('fallback', true);
    expect(el).to.have.attribute('fallback');

    expect(el).to.have.property('delay', 0);
    expect(el).to.have.attribute('delay', '0');

    expect(el).to.have.property('name', 'foo');
    expect(el).to.have.attribute('name', 'foo');

    expect(el).to.have.property('persisted', false);
    expect(el).not.to.have.attribute('persisted');

    expect(el).to.have.property('newRecord', true);
    expect(el).to.have.attribute('new-record');

    expect(el).to.have.property('age', 0);
    expect(el).to.have.attribute('age', '0');

    expect(el).to.have.property('session', 12);
    expect(el).to.have.attribute('session', '12');
  });

  it('falsy values are not set on the element tag', async () => {
    @registerElement('property-falsy-test')
    class PropertyTest extends ImpulseElement {
      @property() placement: string;
      @property({ type: Boolean }) fallback: boolean;
      @property({ type: Number }) delay: number;
    }

    const el: PropertyTest = await fixture(html`<property-falsy-test></property-falsy-test>`);

    expect(el).to.have.property('placement', '');
    expect(el).not.to.have.attribute('placement');

    expect(el).to.have.property('fallback', false);
    expect(el).not.to.have.attribute('fallback');

    expect(el).to.have.property('delay', 0);
    expect(el).not.to.have.attribute('delay');
  });

  it('value can be assigned to a property', async () => {
    @registerElement('property-set-test')
    class PropertyTest extends ImpulseElement {
      @property() placement: string;
      @property({ type: Boolean }) fallback: boolean;
      @property({ type: Number }) delay: number;
    }

    const el: PropertyTest = await fixture(html`<property-set-test></property-set-test>`);

    expect(el).to.have.property('placement', '');
    expect(el).not.to.have.attribute('placement');
    el.placement = 'start';
    expect(el).to.have.property('placement', 'start');
    expect(el).to.have.attribute('placement', 'start');
    el.placement = '';
    expect(el).to.have.property('placement', '');
    expect(el).not.to.have.attribute('placement');

    expect(el).to.have.property('fallback', false);
    expect(el).not.to.have.attribute('fallback');
    el.fallback = true;
    expect(el).to.have.property('fallback', true);
    expect(el).to.have.attribute('fallback');
    el.fallback = false;
    expect(el).to.have.property('fallback', false);
    expect(el).not.to.have.attribute('fallback');

    expect(el).to.have.property('delay', 0);
    expect(el).not.to.have.attribute('delay');
    el.delay = 100_000;
    expect(el).to.have.property('delay', 100_000);
    expect(el).to.have.attribute('delay', '100000');
    el.delay = 0;
    expect(el).to.have.property('delay', 0);
    expect(el).to.have.attribute('delay', '0');
  });
});
