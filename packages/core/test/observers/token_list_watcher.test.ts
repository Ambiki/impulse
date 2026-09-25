import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import Sinon from 'sinon';
import { watchTokenList } from '../../src/observers/token_list_watcher';
import { captureReportedErrors } from '../support/capture_reported_errors';

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

  it('fires tokenUnmatched once with the original token when one of two duplicate tokens is removed', async () => {
    const span = scope.querySelector('span')!;
    span.setAttribute('data-test', 'foo foo');
    await nextFrame();
    resetSpies();

    span.setAttribute('data-test', 'foo');
    await nextFrame();
    expect(delegate.tokenMatched.called).to.be.false;
    expect(delegate.tokenUnmatched.calledOnce).to.be.true;
    expect(delegate.tokenUnmatched.args[0][0].content).to.eq('foo');
  });

  it('fires tokenMatched once when a duplicate of an existing token is added', async () => {
    resetSpies();
    scope.querySelector('span')!.setAttribute('data-test', 'foo bar foo');
    await nextFrame();
    expect(delegate.tokenMatched.calledOnce).to.be.true;
    expect(delegate.tokenMatched.args[0][0].content).to.eq('foo');
    expect(delegate.tokenUnmatched.called).to.be.false;
  });

  it('fires nothing when tokens are only reordered', async () => {
    resetSpies();
    scope.querySelector('span')!.setAttribute('data-test', 'bar foo');
    await nextFrame();
    expect(delegate.tokenMatched.called).to.be.false;
    expect(delegate.tokenUnmatched.called).to.be.false;
  });

  it('fires tokenUnmatched in attribute order when duplicate tokens are cleared', async () => {
    const span = scope.querySelector('span')!;
    span.setAttribute('data-test', 'foo bar foo bar');
    await nextFrame();
    resetSpies();

    span.setAttribute('data-test', '');
    await nextFrame();
    const contents = delegate.tokenUnmatched.args.map(([token]) => token.content);
    expect(contents).to.deep.eq(['foo', 'bar', 'foo', 'bar']);
  });

  it('passes the same token object to tokenUnmatched that tokenMatched received', async () => {
    const span = scope.querySelector('span')!;
    resetSpies();
    span.setAttribute('data-test', 'foo bar baz');
    await nextFrame();
    const added = delegate.tokenMatched.args[0][0];
    resetSpies();

    span.setAttribute('data-test', 'foo bar');
    await nextFrame();
    expect(delegate.tokenUnmatched.calledOnce).to.be.true;
    expect(delegate.tokenUnmatched.args[0][0]).to.eq(added);
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

  it('tracks every token on an element when tokenMatched throws for one of them', async () => {
    const throwing = {
      tokenMatched: Sinon.spy((token: { content: string }) => {
        if (token.content === 'foo') throw new Error('matched failed');
      }),
      tokenUnmatched: Sinon.spy(),
    };
    const errors = captureReportedErrors('matched failed');
    let stopThrowing = () => {};
    try {
      stopThrowing = watchTokenList(scope, 'data-test', throwing);
      expect(errors.reported.length).to.eq(1);
      expect(throwing.tokenMatched.calledTwice).to.be.true;
      expect(throwing.tokenMatched.args[1][0].content).to.eq('bar');

      scope.querySelector('span')!.remove();
      await nextFrame();
      expect(throwing.tokenUnmatched.calledTwice).to.be.true;
    } finally {
      stopThrowing();
      errors.release();
    }
  });

  it('reports every error when the delegate throws for several tokens', () => {
    const throwing = {
      tokenMatched: Sinon.spy((token: { content: string }) => {
        throw new Error(`matched ${token.content} failed`);
      }),
    };
    const errors = captureReportedErrors('failed');
    let stopThrowing = () => {};
    try {
      stopThrowing = watchTokenList(scope, 'data-test', throwing);
      expect(errors.reported.map((error) => error.message)).to.deep.eq(['matched foo failed', 'matched bar failed']);
    } finally {
      stopThrowing();
      errors.release();
    }
  });

  it('still tracks added tokens when tokenUnmatched throws for a removed one', async () => {
    const throwing = {
      tokenMatched: Sinon.spy(),
      tokenUnmatched: Sinon.spy((token: { content: string }) => {
        if (token.content === 'foo') throw new Error('unmatched foo failed');
      }),
    };
    const errors = captureReportedErrors('unmatched foo failed');
    let stopThrowing = () => {};
    try {
      stopThrowing = watchTokenList(scope, 'data-test', throwing);
      throwing.tokenMatched.resetHistory();

      scope.querySelector('span')!.setAttribute('data-test', 'bar baz');
      await nextFrame();
      expect(errors.reported.length).to.eq(1);
      expect(throwing.tokenMatched.calledOnce).to.be.true;
      expect(throwing.tokenMatched.args[0][0].content).to.eq('baz');

      throwing.tokenUnmatched.resetHistory();
      scope.querySelector('span')!.remove();
      await nextFrame();
      expect(throwing.tokenUnmatched.args.map(([token]) => token.content)).to.deep.eq(['bar', 'baz']);
    } finally {
      stopThrowing();
      errors.release();
    }
  });

  it('fires each tokenUnmatched once and stops observing when a delegate calls stop again during stop', async () => {
    let stopReentrant: () => void = () => {};
    const reentrant = { tokenMatched: Sinon.spy(), tokenUnmatched: Sinon.spy((_token: { content: string }) => stopReentrant()) };
    stopReentrant = watchTokenList(scope, 'data-test', reentrant);
    reentrant.tokenMatched.resetHistory();

    stopReentrant();
    expect(reentrant.tokenUnmatched.calledTwice).to.be.true;
    expect(reentrant.tokenUnmatched.args[0][0].content).to.eq('foo');
    expect(reentrant.tokenUnmatched.args[1][0].content).to.eq('bar');

    const late = document.createElement('span');
    late.setAttribute('data-test', 'baz');
    scope.append(late);
    await nextFrame();
    expect(reentrant.tokenMatched.called).to.be.false;
  });

  it('fires every tokenUnmatched and stops observing even if a delegate throws', async () => {
    const throwing = {
      tokenMatched: Sinon.spy(),
      tokenUnmatched: Sinon.spy((token: { content: string }) => {
        if (token.content === 'foo') throw new Error('unmatched failed');
      }),
    };
    const stopThrowing = watchTokenList(scope, 'data-test', throwing);
    throwing.tokenMatched.resetHistory();

    expect(stopThrowing).to.throw('unmatched failed');
    expect(throwing.tokenUnmatched.calledTwice).to.be.true;
    expect(throwing.tokenUnmatched.args[1][0].content).to.eq('bar');

    const late = document.createElement('span');
    late.setAttribute('data-test', 'baz');
    scope.append(late);
    await nextFrame();
    expect(throwing.tokenMatched.called).to.be.false;
  });
});
