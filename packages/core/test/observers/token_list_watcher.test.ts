import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import Sinon from 'sinon';
import { watchTokenList } from '../../src/observers/token_list_watcher';

describe('watchTokenList', () => {
  let scope: HTMLElement;
  let stop: () => void;
  let delegate: { tokenMatched: Sinon.SinonSpy; tokenUnmatched: Sinon.SinonSpy };

  beforeEach(async () => {
    scope = await fixture(html`<div><span data-test="foo bar"></span></div>`);
    delegate = { tokenMatched: Sinon.spy(), tokenUnmatched: Sinon.spy() };
    stop = watchTokenList(scope, 'data-test', delegate);
  });

  afterEach(() => {
    stop?.();
  });

  function resetSpies() {
    delegate.tokenMatched.resetHistory();
    delegate.tokenUnmatched.resetHistory();
  }

  it('fires tokenMatched for every token on initial scan', () => {
    expect(delegate.tokenMatched.calledTwice).to.be.true;
    expect(delegate.tokenMatched.args[0][0].content).to.eq('foo');
    expect(delegate.tokenMatched.args[1][0].content).to.eq('bar');
  });

  it('fires tokenMatched when a token is added in the middle of the value', async () => {
    resetSpies();
    scope.querySelector('span')!.setAttribute('data-test', 'foo baz bar');
    await nextFrame();
    expect(delegate.tokenMatched.calledOnce).to.be.true;
    expect(delegate.tokenMatched.args[0][0].content).to.eq('baz');
    expect(delegate.tokenUnmatched.called).to.be.false;
  });

  it('fires tokenUnmatched when a token is removed from the value', async () => {
    resetSpies();
    scope.querySelector('span')!.setAttribute('data-test', 'bar');
    await nextFrame();
    expect(delegate.tokenUnmatched.calledOnce).to.be.true;
    expect(delegate.tokenUnmatched.args[0][0].content).to.eq('foo');
    expect(delegate.tokenMatched.called).to.be.false;
  });

  it('fires tokenUnmatched for all tokens when the value is cleared', async () => {
    resetSpies();
    scope.querySelector('span')!.setAttribute('data-test', '');
    await nextFrame();
    expect(delegate.tokenUnmatched.calledTwice).to.be.true;
  });

  it('fires tokenUnmatched when an element is removed from the DOM', async () => {
    resetSpies();
    scope.querySelector('span')!.remove();
    await nextFrame();
    expect(delegate.tokenUnmatched.calledTwice).to.be.true;
  });

  it('fires tokenMatched when a new matching element is added', async () => {
    resetSpies();
    const child = document.createElement('span');
    child.setAttribute('data-test', 'baz');
    scope.append(child);
    await nextFrame();
    expect(delegate.tokenMatched.calledOnce).to.be.true;
    expect(delegate.tokenMatched.args[0][0].content).to.eq('baz');
  });

  it('ignores elements outside the scope', async () => {
    const outside = document.createElement('span');
    outside.setAttribute('data-test', 'off-scope');
    document.body.append(outside);
    await nextFrame();
    expect(delegate.tokenMatched.args.every((args) => args[0].content !== 'off-scope')).to.be.true;
    outside.remove();
  });

  it('fires tokenUnmatched for all tracked tokens on stop', () => {
    resetSpies();
    stop();
    stop = () => {};
    expect(delegate.tokenUnmatched.calledTwice).to.be.true;
  });
});
