import { expect } from '@open-wc/testing';
import { isUnchanged } from '../../src/helpers/equality';

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
