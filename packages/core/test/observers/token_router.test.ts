import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import Sinon from 'sinon';
import TokenRouter from '../../src/observers/token_router';
import { captureReportedErrors } from '../support/capture_reported_errors';

interface Delegate {
  tokenMatched: Sinon.SinonSpy;
  tokenUnmatched: Sinon.SinonSpy;
}

function makeDelegate(): Delegate {
  return { tokenMatched: Sinon.spy(), tokenUnmatched: Sinon.spy() };
}

function contents(spy: Sinon.SinonSpy): string[] {
  return spy.args.map(([token]) => token.content);
}

describe('TokenRouter', () => {
  let root: HTMLElement;
  let outer: HTMLElement;
  let inner: HTMLElement;
  let router: TokenRouter;
  const stops: Array<() => void> = [];

  function subscribe(owner: Element, delegate: Delegate) {
    const stop = router.subscribe(owner, delegate);
    stops.push(stop);
    return stop;
  }

  beforeEach(async () => {
    root = await fixture(html`
      <div>
        <x-outer>
          <span id="a" data-test="x-outer.a x-inner.stray"></span>
          <x-inner>
            <span id="b" data-test="x-inner.b"></span>
          </x-inner>
        </x-outer>
      </div>
    `);
    outer = root.querySelector('x-outer')!;
    inner = root.querySelector('x-inner')!;
    router = new TokenRouter('data-test', (content) => content.split('.')[0]);
  });

  afterEach(() => {
    while (stops.length) stops.pop()!();
  });

  it('routes each token to the closest ancestor named by its identifier', () => {
    const outerDelegate = makeDelegate();
    const innerDelegate = makeDelegate();
    subscribe(outer, outerDelegate);
    subscribe(inner, innerDelegate);

    expect(contents(outerDelegate.tokenMatched)).to.deep.eq(['x-outer.a']);
    expect(contents(innerDelegate.tokenMatched)).to.deep.eq(['x-inner.b']);
    expect(outerDelegate.tokenMatched.args[0][0].element).to.eq(root.querySelector('#a'));
  });

  it('replays tokens already owned by an element when it subscribes later', () => {
    subscribe(outer, makeDelegate());
    const innerDelegate = makeDelegate();
    subscribe(inner, innerDelegate);
    expect(contents(innerDelegate.tokenMatched)).to.deep.eq(['x-inner.b']);
  });

  it('reports tokens inserted earlier in the same task when subscribing', () => {
    subscribe(outer, makeDelegate());
    const late = document.createElement('span');
    late.setAttribute('data-test', 'x-inner.late');
    inner.append(late);

    const innerDelegate = makeDelegate();
    subscribe(inner, innerDelegate);
    expect(contents(innerDelegate.tokenMatched)).to.deep.eq(['x-inner.b', 'x-inner.late']);
  });

  it('registers a single document watcher no matter how many elements subscribe', async () => {
    subscribe(outer, makeDelegate());
    subscribe(inner, makeDelegate());
    const matches = Sinon.spy(Element.prototype, 'matches');
    try {
      const added = document.createElement('span');
      added.setAttribute('data-test', 'x-inner.added');
      inner.append(added);
      // A node carrying no token is never matched against the selector at all.
      inner.append(document.createElement('span'));
      await nextFrame();
      expect(matches.args.filter(([selector]) => selector === '[data-test]').length).to.eq(1);
    } finally {
      matches.restore();
    }
  });

  it('delivers tokens on elements added later to their owner', async () => {
    const outerDelegate = makeDelegate();
    const innerDelegate = makeDelegate();
    subscribe(outer, outerDelegate);
    subscribe(inner, innerDelegate);
    outerDelegate.tokenMatched.resetHistory();

    const added = document.createElement('span');
    added.setAttribute('data-test', 'x-outer.added x-inner.added');
    inner.append(added);
    await nextFrame();
    expect(contents(outerDelegate.tokenMatched)).to.deep.eq(['x-outer.added']);
    expect(contents(innerDelegate.tokenMatched)).to.deep.eq(['x-inner.b', 'x-inner.added']);
  });

  it('passes the same token object to tokenUnmatched when the token is removed', async () => {
    const innerDelegate = makeDelegate();
    subscribe(inner, innerDelegate);
    const token = innerDelegate.tokenMatched.args[0][0];

    root.querySelector('#b')!.setAttribute('data-test', '');
    await nextFrame();
    expect(innerDelegate.tokenUnmatched.calledOnce).to.be.true;
    expect(innerDelegate.tokenUnmatched.args[0][0]).to.eq(token);
  });

  it('fires tokenUnmatched for the owner when the element is removed from the DOM', async () => {
    const outerDelegate = makeDelegate();
    const innerDelegate = makeDelegate();
    subscribe(outer, outerDelegate);
    subscribe(inner, innerDelegate);

    root.querySelector('#b')!.remove();
    await nextFrame();
    expect(contents(innerDelegate.tokenUnmatched)).to.deep.eq(['x-inner.b']);
    expect(outerDelegate.tokenUnmatched.called).to.be.false;
  });

  it('ignores tokens whose identifier has no matching ancestor', () => {
    const innerDelegate = makeDelegate();
    subscribe(inner, innerDelegate);
    expect(contents(innerDelegate.tokenMatched)).to.deep.eq(['x-inner.b']);
  });

  it('ignores tokens whose identifier is not a valid selector', async () => {
    const innerDelegate = makeDelegate();
    subscribe(inner, innerDelegate);
    innerDelegate.tokenMatched.resetHistory();

    const invalid = document.createElement('span');
    invalid.setAttribute('data-test', '123.foo .bar x-inner.ok');
    inner.append(invalid);
    await nextFrame();
    expect(contents(innerDelegate.tokenMatched)).to.deep.eq(['x-inner.ok']);
  });

  it('fires tokenUnmatched for every owned token on unsubscribe and nothing afterwards', async () => {
    const outerDelegate = makeDelegate();
    const innerDelegate = makeDelegate();
    subscribe(outer, outerDelegate);
    const stopInner = subscribe(inner, innerDelegate);

    stopInner();
    expect(contents(innerDelegate.tokenUnmatched)).to.deep.eq(['x-inner.b']);
    expect(outerDelegate.tokenUnmatched.called).to.be.false;

    const added = document.createElement('span');
    added.setAttribute('data-test', 'x-inner.added');
    inner.append(added);
    await nextFrame();
    expect(innerDelegate.tokenMatched.calledOnce).to.be.true;
  });

  it('keeps routing to the remaining subscribers after one unsubscribes', async () => {
    const outerDelegate = makeDelegate();
    subscribe(outer, outerDelegate);
    const stopInner = subscribe(inner, makeDelegate());
    stopInner();

    const added = document.createElement('span');
    added.setAttribute('data-test', 'x-outer.added');
    inner.append(added);
    await nextFrame();
    expect(contents(outerDelegate.tokenMatched)).to.deep.eq(['x-outer.a', 'x-outer.added']);
  });

  it('tears down the document watcher once the last subscriber leaves', async () => {
    const stopOuter = subscribe(outer, makeDelegate());
    const stopInner = subscribe(inner, makeDelegate());
    stopOuter();
    stopInner();

    const matches = Sinon.spy(Element.prototype, 'matches');
    try {
      inner.append(document.createElement('span'));
      await nextFrame();
      expect(matches.args.some(([selector]) => selector === '[data-test]')).to.be.false;
    } finally {
      matches.restore();
    }
  });

  it('starts a fresh watcher when an element subscribes again after a full teardown', () => {
    const stopOuter = subscribe(outer, makeDelegate());
    stopOuter();

    const outerDelegate = makeDelegate();
    subscribe(outer, outerDelegate);
    expect(contents(outerDelegate.tokenMatched)).to.deep.eq(['x-outer.a']);
  });

  it('still tracks a token whose delegate throws on match, and reports it on unsubscribe', () => {
    const outerDelegate = {
      tokenMatched: Sinon.spy(() => {
        throw new Error('outer matched failed');
      }),
      tokenUnmatched: Sinon.spy(),
    };
    const innerDelegate = makeDelegate();
    const errors = captureReportedErrors('outer matched failed');
    try {
      const stopOuter = subscribe(outer, outerDelegate);
      subscribe(inner, innerDelegate);
      expect(errors.reported.length).to.eq(1);
      expect(contents(innerDelegate.tokenMatched)).to.deep.eq(['x-inner.b']);

      stopOuter();
      expect(contents(outerDelegate.tokenUnmatched)).to.deep.eq(['x-outer.a']);
    } finally {
      errors.release();
    }
  });

  it('reports every owned token on unsubscribe even if the delegate throws, then rethrows the first error', async () => {
    root.querySelector('#b')!.setAttribute('data-test', 'x-inner.b x-inner.c');
    const innerDelegate = {
      tokenMatched: Sinon.spy(),
      tokenUnmatched: Sinon.spy((token: { content: string }) => {
        if (token.content === 'x-inner.b') throw new Error('unmatched failed');
      }),
    };
    const stopInner = subscribe(inner, innerDelegate);
    stops.pop();

    expect(stopInner).to.throw('unmatched failed');
    expect(contents(innerDelegate.tokenUnmatched)).to.deep.eq(['x-inner.b', 'x-inner.c']);

    const added = document.createElement('span');
    added.setAttribute('data-test', 'x-inner.added');
    inner.append(added);
    await nextFrame();
    expect(innerDelegate.tokenMatched.callCount).to.eq(2);
  });

  it('is a no-op to unsubscribe twice', () => {
    const innerDelegate = makeDelegate();
    const stopInner = subscribe(inner, innerDelegate);
    stopInner();
    stopInner();
    expect(innerDelegate.tokenUnmatched.calledOnce).to.be.true;
  });
});
