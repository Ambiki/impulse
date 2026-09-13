import { expect } from '@open-wc/testing';
import Sinon from 'sinon';
import { invokeEach } from '../../src/helpers/invoke_each';

describe('invokeEach', () => {
  it('calls fn once per item in order', () => {
    const fn = Sinon.spy();
    invokeEach(['a', 'b', 'c'], fn);
    expect(fn.args.map(([item]) => item)).to.deep.eq(['a', 'b', 'c']);
  });

  it('visits every item and rethrows the first error afterwards', () => {
    const seen: string[] = [];
    const run = () =>
      invokeEach(['a', 'b', 'c'], (item) => {
        seen.push(item);
        if (item !== 'c') throw new Error(`${item} failed`);
      });

    expect(run).to.throw('a failed');
    expect(seen).to.deep.eq(['a', 'b', 'c']);
  });

  it('accepts any iterable', () => {
    const fn = Sinon.spy();
    invokeEach(new Set([1, 2]), fn);
    expect(fn.calledTwice).to.be.true;
  });
});
