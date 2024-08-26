import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import Sinon from 'sinon';
import { TokenListObserver } from '../../src';

describe('TokenListObserver', () => {
  let el: HTMLElement;
  let observer: TokenListObserver;
  let delegate: {
    tokenMatched: Sinon.SinonSpy;
    tokenUnmatched: Sinon.SinonSpy;
  };

  beforeEach(async () => {
    el = await fixture(html`<div data-test="foo bar"><span></span></div>`);
    delegate = {
      tokenMatched: Sinon.spy(),
      tokenUnmatched: Sinon.spy(),
    };
    observer = new TokenListObserver(el, 'data-test', delegate);
    observer.start();
  });

  afterEach(() => {
    observer?.stop();
  });

  function resetSpies() {
    delegate.tokenMatched.resetHistory();
    delegate.tokenUnmatched.resetHistory();
  }

  it('calls tokenMatched', () => {
    expect(delegate.tokenMatched.calledTwice).to.be.true;
    expect(delegate.tokenMatched.args[0][0].content).to.eq('foo');
    expect(delegate.tokenMatched.args[1][0].content).to.eq('bar');
  });

  it('adding a token in the middle', async () => {
    resetSpies();
    delegate.tokenMatched.resetHistory();
    el.setAttribute('data-test', 'foo baz bar');
    await nextFrame();
    expect(delegate.tokenMatched.args[0][0].content).to.eq('baz');
    expect(delegate.tokenMatched.calledOnce).to.be.true;
    expect(delegate.tokenUnmatched.called).to.be.false;
  });

  it('removing a token', async () => {
    resetSpies();
    el.setAttribute('data-test', 'bar');
    await nextFrame();
    expect(delegate.tokenUnmatched.args[0][0].content).to.eq('foo');
    expect(delegate.tokenUnmatched.calledOnce).to.be.true;
    expect(delegate.tokenMatched.called).to.be.false;
  });

  it('removing all tokens', async () => {
    resetSpies();
    el.setAttribute('data-test', '');
    await nextFrame();
    expect(delegate.tokenUnmatched.args[0][0].content).to.eq('foo');
    expect(delegate.tokenUnmatched.args[1][0].content).to.eq('bar');
    expect(delegate.tokenUnmatched.calledTwice).to.be.true;
    expect(delegate.tokenMatched.called).to.be.false;
  });

  it('removing the only token', async () => {
    el.setAttribute('data-test', 'foo');
    await nextFrame();
    resetSpies();
    el.setAttribute('data-test', '');
    await nextFrame();
    expect(delegate.tokenUnmatched.calledOnce).to.be.true;
    expect(delegate.tokenUnmatched.args[0][0].content).to.eq('foo');
    expect(delegate.tokenMatched.called).to.be.false;
  });
});
