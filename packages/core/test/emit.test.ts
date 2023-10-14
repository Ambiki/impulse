import { expect, fixture, html } from '@open-wc/testing';
import Sinon from 'sinon';
import { ImpulseElement, registerElement } from '../src';

describe('emit', () => {
  @registerElement('emit-test')
  class EmitTest extends ImpulseElement {}

  let el: EmitTest;
  beforeEach(async () => {
    el = await fixture(html`<emit-test></emit-test>`);
  });

  it('should emit an event', () => {
    const handleChange = Sinon.spy();
    document.addEventListener('emit-test:change', handleChange);
    el.emit('change');

    expect(handleChange.calledOnce).to.be.true;
  });

  it('should be able to change the prefix', () => {
    const handleChange = Sinon.spy();
    document.addEventListener('foo:change', handleChange);
    el.emit('change', { prefix: 'foo' });

    expect(handleChange.calledOnce).to.be.true;
  });

  it('should be able to remove the prefix', () => {
    const handleChange = Sinon.spy();
    document.addEventListener('change', handleChange);
    el.emit('change', { prefix: false });

    expect(handleChange.calledOnce).to.be.true;
  });

  it('should return an empty object for the detail property if it is not provided', () => {
    const handleChange = Sinon.spy();
    document.addEventListener('emit-test:change', handleChange);
    el.emit('change');

    expect(handleChange.calledOnce).to.be.true;
    expect(handleChange.getCall(0).args[0].detail).to.deep.equal({});
  });

  it('should be able to set the detail property', () => {
    const handleChange = Sinon.spy();
    document.addEventListener('emit-test:change', handleChange);
    el.emit('change', { detail: { name: 'John' } });

    expect(handleChange.calledOnce).to.be.true;
    expect(handleChange.getCall(0).args[0].detail).to.deep.equal({ name: 'John' });
  });
});
