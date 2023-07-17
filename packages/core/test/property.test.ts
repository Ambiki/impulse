import { expect, fixture, html } from '@open-wc/testing';
import Sinon from 'sinon';
import { ImpulseElement, property, registerElement } from '../src';

describe('@property', () => {
  @registerElement('property-test')
  class PropertyTest extends ImpulseElement {
    placementChangedSpy = Sinon.spy();
    fallbackChangedSpy = Sinon.spy();
    startedChangedSpy = Sinon.spy();
    lastNameChangedSpy = Sinon.spy();
    joiningChangedSpy = Sinon.spy();
    timeoutChangedSpy = Sinon.spy();

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

    // Override default value
    @property() value = 'litchi';
    @property({ type: Boolean }) started = true;
    @property({ type: Number }) recordCount = 44;

    // Without explicitly setting the default value
    @property() lastName: string;
    @property({ type: Number }) timeout: number;
    @property({ type: Boolean }) joining: boolean;

    placementChanged(newValue: string, oldValue: string) {
      this.placementChangedSpy.call(this, newValue, oldValue);
    }

    fallbackChanged(newValue: boolean, oldValue: boolean) {
      this.fallbackChangedSpy.call(this, newValue, oldValue);
    }

    startedChanged(newValue: boolean, oldValue: boolean) {
      this.startedChangedSpy.call(this, newValue, oldValue);
    }

    lastNameChanged(newValue: string, oldValue: string) {
      this.lastNameChangedSpy.call(this, newValue, oldValue);
    }

    joiningChanged(newValue: boolean, oldValue: boolean) {
      this.joiningChangedSpy.call(this, newValue, oldValue);
    }

    timeoutChanged(newValue: boolean, oldValue: boolean) {
      this.timeoutChangedSpy.call(this, newValue, oldValue);
    }
  }

  let el: PropertyTest;
  beforeEach(async () => {
    el = await fixture(html`
      <property-test
        placement="bottom"
        fallback
        delay="0"
        value="guava"
        started="false"
        record-count="22"
      ></property-test>
    `);
  });

  it('sets the property value from the element', () => {
    expect(el).to.have.property('placement', 'bottom');
    expect(el).to.have.attribute('placement', 'bottom');

    expect(el).to.have.property('fallback', true);
    expect(el).to.have.attribute('fallback');

    expect(el).to.have.property('delay', 0);
    expect(el).to.have.attribute('delay', '0');
  });

  it('sets the property value by default', () => {
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

  it('default property value can be overwritten from the element', () => {
    expect(el).to.have.property('value', 'guava');
    expect(el).to.have.attribute('value', 'guava');

    expect(el).to.have.property('started', false);
    expect(el).to.have.attribute('started', 'false');

    expect(el).to.have.property('recordCount', 22);
    expect(el).to.have.attribute('record-count', '22');
  });

  it('sets the property value to the element', () => {
    expect(el).to.have.property('lastName', '');
    expect(el).to.have.attribute('last-name', '');

    expect(el).to.have.property('timeout', 0);
    expect(el).to.have.attribute('timeout', '0');

    expect(el).to.have.property('joining', false);
    expect(el).not.to.have.attribute('joining');
  });

  it('value can be assigned to a property', () => {
    el.placement = 'start';
    expect(el).to.have.property('placement', 'start');
    expect(el).to.have.attribute('placement', 'start');
    el.placement = '';
    expect(el).to.have.property('placement', '');
    expect(el).to.have.attribute('placement', '');

    el.fallback = true;
    expect(el).to.have.property('fallback', true);
    expect(el).to.have.attribute('fallback');
    el.fallback = false;
    expect(el).to.have.property('fallback', false);
    expect(el).not.to.have.attribute('fallback');

    el.delay = 100_000;
    expect(el).to.have.property('delay', 100_000);
    expect(el).to.have.attribute('delay', '100000');
    el.delay = 0;
    expect(el).to.have.property('delay', 0);
    expect(el).to.have.attribute('delay', '0');
  });

  it('calls the property changed callback', () => {
    el.placement = 'top';
    expect(el.placementChangedSpy.calledOnceWith('top', 'bottom')).to.be.true;
    expect(el.placementChangedSpy.calledOn(el)).to.be.true;

    el.fallback = false;
    expect(el.fallbackChangedSpy.calledOnceWith(false, true)).to.be.true;
    expect(el.fallbackChangedSpy.calledOn(el)).to.be.true;
    el.fallback = true;
    expect(el.fallbackChangedSpy.calledTwice).to.be.true;
    expect(el.fallbackChangedSpy.calledWith(true, false)).to.be.true;
    expect(el.fallbackChangedSpy.calledOn(el)).to.be.true;

    // element has `started='false'` attribute.
    el.started = true;
    expect(el.startedChangedSpy.calledOnceWith(true, false)).to.be.true;
    expect(el.startedChangedSpy.calledOn(el)).to.be.true;

    el.lastName = 'Fleming';
    expect(el.lastNameChangedSpy.calledOnceWith('Fleming', '')).to.be.true;
    expect(el.lastNameChangedSpy.calledOn(el)).to.be.true;

    el.joining = true;
    expect(el.joiningChangedSpy.calledOnceWith(true, false)).to.be.true;
    expect(el.joiningChangedSpy.calledOn(el)).to.be.true;

    el.timeout = 100;
    expect(el.timeoutChangedSpy.calledOnceWith(100, 0)).to.be.true;
    expect(el.timeoutChangedSpy.calledOn(el)).to.be.true;
  });
});
