import { expect, fixture, html } from '@open-wc/testing';
import Sinon from 'sinon';
import { ImpulseElement, property, registerElement } from '../src';
import { fromAttribute, isUnchanged } from '../src/property';

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
    overrideConfigChanged = Sinon.fake();

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

  it('should pass the change callback the same value as the property getter when an attribute is removed', () => {
    el.removeAttribute('numeric-value');
    expect(el).to.have.property('numericValue', 0);
    expect(el.numericValueChanged.calledOnceWith(0, 8000)).to.be.true;

    el.removeAttribute('placement');
    expect(el).to.have.property('placement', '');
    expect(el.placementChanged.calledOnceWith('', 'bottom')).to.be.true;

    el.removeAttribute('fallback');
    expect(el).to.have.property('fallback', false);
    expect(el.fallbackChanged.calledOnceWith(false, true)).to.be.true;

    el.removeAttribute('fruits');
    expect(el).to.have.property('fruits').to.deep.equal([]);
    expect(el.fruitsChanged.getCall(0).args[0]).to.deep.equal([]);
    expect(el.fruitsChanged.getCall(0).args[1]).to.deep.equal(['Guava', 'Litchi']);

    el.removeAttribute('config');
    expect(el).to.have.property('config').to.deep.equal({});
    expect(el.configChanged.getCall(0).args[0]).to.deep.equal({});
    expect(el.configChanged.getCall(0).args[1]).to.deep.equal({ foo: 'bar' });
  });

  it('should not fire the change callback when removing an attribute that already reads as the empty value', () => {
    // An empty attribute and a missing one both read as `0`/`''`, so removing it is not a change.
    el.setAttribute('numeric-value', '');
    expect(el).to.have.property('numericValue', 0);
    el.numericValueChanged.resetHistory();
    el.removeAttribute('numeric-value');
    expect(el).to.have.property('numericValue', 0);
    expect(el.numericValueChanged.called).to.be.false;

    el.setAttribute('placement', '');
    expect(el).to.have.property('placement', '');
    el.placementChanged.resetHistory();
    el.removeAttribute('placement');
    expect(el).to.have.property('placement', '');
    expect(el.placementChanged.called).to.be.false;
  });

  it('should fall back to an empty collection rather than throw when the attribute is not valid JSON', () => {
    el.setAttribute('fruits', '{');
    expect(el).to.have.property('fruits').to.deep.equal([]);
    expect(el.fruitsChanged.getCall(0).args[0]).to.deep.equal([]);

    el.setAttribute('config', 'nope');
    expect(el).to.have.property('config').to.deep.equal({});
    expect(el.configChanged.getCall(0).args[0]).to.deep.equal({});
  });

  it('should not fire the collection callbacks when a reformatted attribute parses to the same value', () => {
    // `fromAttribute` parses a fresh value on every call, so the two sides are never the same reference. Only a
    // structural comparison can tell that this write changed nothing but the whitespace.
    el.setAttribute('config', '{"foo":"bar"}');
    expect(el.configChanged.called).to.be.false;

    el.setAttribute('fruits', '["Guava","Litchi"]');
    expect(el.fruitsChanged.called).to.be.false;

    // The case this is really for: a server re-render emitting the same nested payload, formatted differently.
    el.setAttribute('config', '{ "foo": "bar", "nested": { "fruits": ["Guava", "Litchi"] } }');
    el.configChanged.resetHistory();
    el.setAttribute('config', '{"nested":{"fruits":["Guava","Litchi"]},"foo":"bar"}');
    expect(el.configChanged.called).to.be.false;
  });

  it('should not fire the collection callbacks when the keys are written in a different order', () => {
    el.setAttribute('override-config', '{ "property": false, "extra": 1 }');
    expect(el.overrideConfig).to.deep.equal({ property: false, extra: 1 });
    el.overrideConfigChanged.resetHistory();

    el.setAttribute('override-config', '{ "extra": 1, "property": false }');
    expect(el.overrideConfigChanged.called).to.be.false;
  });

  it('should not fire the collection callbacks when removing an attribute that already reads as the empty value', () => {
    // A missing attribute and an empty collection both read as `[]`/`{}`, so removing it is not a change.
    el.setAttribute('fruits', '[]');
    el.fruitsChanged.resetHistory();
    el.removeAttribute('fruits');
    expect(el).to.have.property('fruits').to.deep.equal([]);
    expect(el.fruitsChanged.called).to.be.false;

    el.setAttribute('config', '{}');
    el.configChanged.resetHistory();
    el.removeAttribute('config');
    expect(el).to.have.property('config').to.deep.equal({});
    expect(el.configChanged.called).to.be.false;
  });

  it('should fire the collection callbacks when the parsed value differs', () => {
    el.setAttribute('fruits', '["Guava", "Litchi", "Mango"]');
    expect(el.fruitsChanged.calledOnce).to.be.true;
    expect(el.fruitsChanged.getCall(0).args[0]).to.deep.equal(['Guava', 'Litchi', 'Mango']);
    expect(el.fruitsChanged.getCall(0).args[1]).to.deep.equal(['Guava', 'Litchi']);

    el.setAttribute('config', '{ "foo": "baz" }');
    expect(el.configChanged.calledOnce).to.be.true;
    expect(el.configChanged.getCall(0).args[0]).to.deep.equal({ foo: 'baz' });
    expect(el.configChanged.getCall(0).args[1]).to.deep.equal({ foo: 'bar' });
  });

  it('should not fire the Number callback when the value transforms to NaN on both sides', () => {
    // Starts from `numeric-value="8_000"` (=> 8000).
    el.setAttribute('numeric-value', 'abc');
    expect(el.numericValueChanged.calledOnce).to.be.true;
    expect(Number.isNaN(el.numericValueChanged.getCall(0).args[0])).to.be.true;
    expect(el.numericValueChanged.getCall(0).args[1]).to.equal(8000);

    // NaN -> NaN is unchanged, so the callback must not fire again.
    el.setAttribute('numeric-value', 'xyz');
    expect(el.numericValueChanged.calledOnce).to.be.true;
  });
});

describe('fromAttribute', () => {
  it('converts a String attribute', () => {
    expect(fromAttribute('bottom', String)).to.eq('bottom');
    expect(fromAttribute('', String)).to.eq('');
    // A removed attribute reads as the empty string, never `null`.
    expect(fromAttribute(null, String)).to.eq('');
  });

  it('converts a Number attribute', () => {
    expect(fromAttribute('22', Number)).to.eq(22);
    expect(fromAttribute('8_000', Number)).to.eq(8000);
    expect(fromAttribute('', Number)).to.eq(0);
    // A removed attribute reads as `0`, never `NaN`.
    expect(fromAttribute(null, Number)).to.eq(0);
    expect(Number.isNaN(fromAttribute('abc', Number))).to.be.true;
  });

  it('converts a Boolean attribute', () => {
    expect(fromAttribute('', Boolean)).to.be.true;
    expect(fromAttribute('true', Boolean)).to.be.true;
    expect(fromAttribute('false', Boolean)).to.be.false;
    expect(fromAttribute(null, Boolean)).to.be.false;
  });

  it('converts a Array attribute', () => {
    expect(fromAttribute('["Guava"]', Array)).to.eql(['Guava']);
    expect(fromAttribute(null, Array)).to.eql([]);
    expect(fromAttribute('{', Array)).to.eql([]);
  });

  it('converts a Object attribute', () => {
    expect(fromAttribute('{ "foo": "bar" }', Object)).to.eql({ foo: 'bar' });
    expect(fromAttribute(null, Object)).to.eql({});
    expect(fromAttribute('nope', Object)).to.eql({});
  });
});

describe('isUnchanged', () => {
  it('compares primitives with `Object.is`', () => {
    expect(isUnchanged('bottom', 'bottom', String)).to.be.true;
    expect(isUnchanged('bottom', 'top', String)).to.be.false;
    expect(isUnchanged(8000, 8000, Number)).to.be.true;
    expect(isUnchanged(8000, 22, Number)).to.be.false;
    // `NaN` on both sides is unchanged, which `===` would get wrong.
    expect(isUnchanged(Number.NaN, Number.NaN, Number)).to.be.true;
    expect(isUnchanged(true, true, Boolean)).to.be.true;
    expect(isUnchanged(true, false, Boolean)).to.be.false;
  });

  it('compares an Array structurally', () => {
    expect(isUnchanged([], [], Array)).to.be.true;
    expect(isUnchanged(['Guava'], ['Guava'], Array)).to.be.true;
    expect(isUnchanged(['Guava'], ['Litchi'], Array)).to.be.false;
    expect(isUnchanged(['Guava'], ['Guava', 'Litchi'], Array)).to.be.false;
    // Order is significant in an Array, unlike the keys of an Object.
    expect(isUnchanged(['Guava', 'Litchi'], ['Litchi', 'Guava'], Array)).to.be.false;
    expect(isUnchanged([{ foo: ['bar'] }], [{ foo: ['bar'] }], Array)).to.be.true;
    expect(isUnchanged([{ foo: ['bar'] }], [{ foo: ['baz'] }], Array)).to.be.false;
  });

  it('compares an Object structurally', () => {
    expect(isUnchanged({}, {}, Object)).to.be.true;
    expect(isUnchanged({ foo: 'bar' }, { foo: 'bar' }, Object)).to.be.true;
    expect(isUnchanged({ foo: 'bar' }, { foo: 'baz' }, Object)).to.be.false;
    expect(isUnchanged({ foo: 'bar' }, { foo: 'bar', extra: 1 }, Object)).to.be.false;
    // Key order is not part of the value.
    expect(isUnchanged({ a: 1, b: 2 }, { b: 2, a: 1 }, Object)).to.be.true;
    // A key whose value is `undefined` is not the same as a missing key.
    expect(isUnchanged({ foo: undefined }, {}, Object)).to.be.false;
    expect(isUnchanged({ foo: { bar: [1, 2] } }, { foo: { bar: [1, 2] } }, Object)).to.be.true;
    expect(isUnchanged({ foo: { bar: [1, 2] } }, { foo: { bar: [2, 1] } }, Object)).to.be.false;
  });

  it('does not confuse `null`, an Array, and an Object with each other', () => {
    expect(isUnchanged(null, {}, Object)).to.be.false;
    expect(isUnchanged({}, null, Object)).to.be.false;
    expect(isUnchanged([], {}, Array)).to.be.false;
    expect(isUnchanged({ 0: 'Guava', length: 1 }, ['Guava'], Array)).to.be.false;
  });
});
