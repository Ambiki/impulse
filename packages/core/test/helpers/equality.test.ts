import { expect } from '@open-wc/testing';
import { isDeepEqual } from '../../src/helpers/equality';

describe('isDeepEqual', () => {
  it('compares primitives with `Object.is`', () => {
    expect(isDeepEqual('bottom', 'bottom')).to.be.true;
    expect(isDeepEqual('bottom', 'top')).to.be.false;
    expect(isDeepEqual(8000, 8000)).to.be.true;
    expect(isDeepEqual(8000, 22)).to.be.false;
    // `NaN` equals itself, which `===` would get wrong.
    expect(isDeepEqual(Number.NaN, Number.NaN)).to.be.true;
    expect(isDeepEqual(true, true)).to.be.true;
    expect(isDeepEqual(true, false)).to.be.false;
  });

  it('compares an Array structurally', () => {
    expect(isDeepEqual([], [])).to.be.true;
    expect(isDeepEqual(['Guava'], ['Guava'])).to.be.true;
    expect(isDeepEqual(['Guava'], ['Litchi'])).to.be.false;
    expect(isDeepEqual(['Guava'], ['Guava', 'Litchi'])).to.be.false;
    // Order is significant in an Array, unlike the keys of an Object.
    expect(isDeepEqual(['Guava', 'Litchi'], ['Litchi', 'Guava'])).to.be.false;
    expect(isDeepEqual([{ foo: ['bar'] }], [{ foo: ['bar'] }])).to.be.true;
    expect(isDeepEqual([{ foo: ['bar'] }], [{ foo: ['baz'] }])).to.be.false;
  });

  it('compares an Object structurally', () => {
    expect(isDeepEqual({}, {})).to.be.true;
    expect(isDeepEqual({ foo: 'bar' }, { foo: 'bar' })).to.be.true;
    expect(isDeepEqual({ foo: 'bar' }, { foo: 'baz' })).to.be.false;
    expect(isDeepEqual({ foo: 'bar' }, { foo: 'bar', extra: 1 })).to.be.false;
    // Key order is not part of the value.
    expect(isDeepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).to.be.true;
    // A key whose value is `undefined` is not the same as a missing key.
    expect(isDeepEqual({ foo: undefined }, {})).to.be.false;
    expect(isDeepEqual({ foo: { bar: [1, 2] } }, { foo: { bar: [1, 2] } })).to.be.true;
    expect(isDeepEqual({ foo: { bar: [1, 2] } }, { foo: { bar: [2, 1] } })).to.be.false;
  });

  it('does not confuse `null`, an Array, and an Object with each other', () => {
    expect(isDeepEqual(null, {})).to.be.false;
    expect(isDeepEqual({}, null)).to.be.false;
    expect(isDeepEqual([], {})).to.be.false;
    expect(isDeepEqual({ 0: 'Guava', length: 1 }, ['Guava'])).to.be.false;
  });
});
