import { expect, fixture, html } from '@open-wc/testing';
import Sinon from 'sinon';
import { ImpulseElement, property, registerElement } from '../src';

describe('@property', () => {
  @registerElement('property-test')
  class PropertyTest extends ImpulseElement {
    placementChanged = Sinon.fake();
    fallbackChanged = Sinon.fake();
    startedChanged = Sinon.fake();
    lastNameChanged = Sinon.fake();
    joiningChanged = Sinon.fake();
    timeoutChanged = Sinon.fake();
    fruitsChanged = Sinon.fake();
    sportsChanged = Sinon.fake();
    namesChanged = Sinon.fake();
    friendsChanged = Sinon.fake();
    configChanged = Sinon.fake();
    zeroConfigChanged = Sinon.fake();
    numericValueChanged = Sinon.fake();

    // From HTML
    @property() placement: string;
    @property({ type: Boolean }) fallback: boolean;
    @property({ type: Number }) delay: number;
    @property({ type: Array }) fruits: string[];
    @property({ type: Object }) config: Record<string, string>;
    @property({ type: Number }) numericValue: number;

    // Default value
    @property() name = 'foo';
    @property({ type: Boolean }) persisted = false;
    @property({ type: Boolean }) newRecord = true;
    @property({ type: Number }) age = 0;
    @property({ type: Number }) session = 12;
    @property({ type: Array }) sports = ['Football', 'Cricket'];
    @property({ type: Object }) defaultConfig = { routes: false };

    // Override default value
    @property() value = 'litchi';
    @property({ type: Boolean }) started = true;
    @property({ type: Number }) recordCount = 44;
    @property({ type: Array }) names: string[] = [];
    @property({ type: Object }) overrideConfig = {};

    // Without explicitly setting the default value
    @property() lastName: string;
    @property({ type: Number }) timeout: number;
    @property({ type: Boolean }) joining: boolean;
    @property({ type: Array }) friends: string[];
    @property({ type: Object }) zeroConfig: Record<string, string>;
  }

  let el: PropertyTest;
  beforeEach(async () => {
    el = await fixture(html`
      <property-test
        placement="bottom"
        fallback
        delay="0"
        fruits='["Guava", "Litchi"]'
        config='{ "foo": "bar" }'
        value="guava"
        started="false"
        record-count="22"
        numeric-value="8_000"
        names='["Md", "Abeid"]'
        override-config='{ "property": false }'
      ></property-test>
    `);
  });

  it('should set the property value from the element', () => {
    expect(el).to.have.property('placement', 'bottom');
    expect(el).to.have.attribute('placement', 'bottom');

    expect(el).to.have.property('fallback', true);
    expect(el).to.have.attribute('fallback');

    expect(el).to.have.property('delay', 0);
    expect(el).to.have.attribute('delay', '0');

    expect(el).to.have.property('fruits').to.deep.equal(['Guava', 'Litchi']);
    expect(el).to.have.attribute('fruits').to.deep.equal('["Guava", "Litchi"]');

    expect(el).to.have.property('config').to.deep.equal({ foo: 'bar' });
    expect(el).to.have.attribute('config').to.deep.equal('{ "foo": "bar" }');

    expect(el).to.have.property('numericValue', 8000);
    expect(el).to.have.attribute('numeric-value', '8_000');
  });

  it('should set the property value by default', () => {
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

    expect(el).to.have.property('sports').to.deep.equal(['Football', 'Cricket']);
    expect(el).to.have.attribute('sports').to.deep.equal('["Football","Cricket"]');

    expect(el).to.have.property('defaultConfig').to.deep.equal({ routes: false });
    expect(el).to.have.attribute('default-config').to.deep.equal('{"routes":false}');
  });

  it('should be able to overwrite the default property value', () => {
    expect(el).to.have.property('value', 'guava');
    expect(el).to.have.attribute('value', 'guava');

    expect(el).to.have.property('started', false);
    expect(el).to.have.attribute('started', 'false');

    expect(el).to.have.property('recordCount', 22);
    expect(el).to.have.attribute('record-count', '22');

    expect(el).to.have.property('names').to.deep.equal(['Md', 'Abeid']);
    expect(el).to.have.attribute('names').to.deep.equal('["Md", "Abeid"]');

    expect(el).to.have.property('overrideConfig').to.deep.equal({ property: false });
    expect(el).to.have.attribute('override-config').to.deep.equal('{ "property": false }');
  });

  it('should set the property value to the element', () => {
    expect(el).to.have.property('lastName', '');
    expect(el).to.have.attribute('last-name', '');

    expect(el).to.have.property('timeout', 0);
    expect(el).to.have.attribute('timeout', '0');

    expect(el).to.have.property('joining', false);
    expect(el).not.to.have.attribute('joining');

    expect(el).to.have.property('friends').to.deep.equal([]);
    expect(el).to.have.attribute('friends').to.deep.equal('[]');

    expect(el).to.have.property('zeroConfig').to.deep.equal({});
    expect(el).to.have.attribute('zero-config').to.deep.equal('{}');
  });

  it('should be able to assign value to a property', () => {
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

    el.zeroConfig = { fallback: 'yes' };
    expect(el).to.have.property('zeroConfig').to.deep.equal({ fallback: 'yes' });
    expect(el).to.have.attribute('zero-config').to.deep.equal('{"fallback":"yes"}');
  });

  it('should call the property [property]Changed callback', () => {
    el.placement = 'top';
    expect(el.placementChanged.calledOnceWith('top', 'bottom')).to.be.true;
    expect(el.placementChanged.calledOn(el)).to.be.true;

    el.fallback = false;
    expect(el.fallbackChanged.calledOnceWith(false, true)).to.be.true;
    expect(el.fallbackChanged.calledOn(el)).to.be.true;
    el.fallback = true;
    expect(el.fallbackChanged.calledTwice).to.be.true;
    expect(el.fallbackChanged.calledWith(true, false)).to.be.true;
    expect(el.fallbackChanged.calledOn(el)).to.be.true;

    // element has `started='false'` attribute.
    el.started = true;
    expect(el.startedChanged.calledOnceWith(true, false)).to.be.true;
    expect(el.startedChanged.calledOn(el)).to.be.true;

    el.lastName = 'Fleming';
    expect(el.lastNameChanged.calledOnceWith('Fleming', '')).to.be.true;
    expect(el.lastNameChanged.calledOn(el)).to.be.true;

    el.joining = true;
    expect(el.joiningChanged.calledOnceWith(true, false)).to.be.true;
    expect(el.joiningChanged.calledOn(el)).to.be.true;

    el.timeout = 100;
    expect(el.timeoutChanged.calledOnceWith(100, 0)).to.be.true;
    expect(el.timeoutChanged.calledOn(el)).to.be.true;

    el.fruits = ['Guava'];
    expect(el.fruitsChanged.getCall(0).args[0]).to.deep.equal(['Guava']);
    expect(el.fruitsChanged.getCall(0).args[1]).to.deep.equal(['Guava', 'Litchi']);

    el.sports = [];
    expect(el.sportsChanged.getCall(0).args[0]).to.deep.equal([]);
    expect(el.sportsChanged.getCall(0).args[1]).to.deep.equal(['Football', 'Cricket']);

    el.names = ['Rachel'];
    expect(el.namesChanged.getCall(0).args[0]).to.deep.equal(['Rachel']);
    expect(el.namesChanged.getCall(0).args[1]).to.deep.equal(['Md', 'Abeid']);

    el.friends = ['Mike'];
    expect(el.friendsChanged.getCall(0).args[0]).to.deep.equal(['Mike']);
    expect(el.friendsChanged.getCall(0).args[1]).to.deep.equal([]);

    el.config = { bar: 'foo' };
    expect(el.configChanged.getCall(0).args[0]).to.deep.equal({ bar: 'foo' });
    expect(el.configChanged.getCall(0).args[1]).to.deep.equal({ foo: 'bar' });

    el.zeroConfig = { name: 'Abeid' };
    expect(el.zeroConfigChanged.getCall(0).args[0]).to.deep.equal({ name: 'Abeid' });
    expect(el.zeroConfigChanged.getCall(0).args[1]).to.deep.equal({});

    el.numericValue = 8000;
    expect(el.numericValueChanged.called).to.be.false;
    el.numericValue = 9000;
    expect(el.numericValueChanged.calledOnceWith(9000, 8000)).to.be.true;
  });
});
