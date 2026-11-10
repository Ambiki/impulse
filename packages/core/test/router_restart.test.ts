import { expect, fixture, html } from '@open-wc/testing';
import Sinon from 'sinon';
import { ImpulseElement, registerElement, target, whenInitialized } from '../src';

// The only Owner on this page, so moving it unsubscribes the last subscriber of the shared `[data-target]` and
// `[data-action]` routers, which stops them; they start again when the Owner initializes at its new position. Every
// other test file has an Owner of its own that keeps the routers running.
@registerElement('router-restart-test')
class RouterRestartTest extends ImpulseElement {
  @target() item: HTMLElement | null;
  handle = Sinon.spy();
  moveOnConnect = false;

  itemConnected() {
    if (!this.moveOnConnect) return;
    this.moveOnConnect = false;
    this.parentElement!.append(this);
  }
}

describe('an Owner whose move stops the token routers', () => {
  let owner: RouterRestartTest;
  beforeEach(async () => {
    const host = await fixture<HTMLElement>(html`<div><router-restart-test></router-restart-test></div>`);
    owner = host.querySelector<RouterRestartTest>('router-restart-test')!;
    await whenInitialized(owner);
  });

  // Inserts `element`, whose first token connects it and has the Owner moved, so the routers stop while its other
  // tokens are still being delivered. It is then removed before the Owner initializes again: the move's own records,
  // which tell the routers the Owner was moved, come with the next microtask, and initializing waits a microtask more.
  async function insertAndRemoveAsTheRoutersStop(element: HTMLElement) {
    owner.moveOnConnect = true;
    owner.append(element);
    await Promise.resolve();
    element.remove();
    await whenInitialized(owner);
  }

  it('should not take a removed element as the Target from the tokens being delivered as the router stopped', async () => {
    const element = document.createElement('div');
    element.setAttribute('data-target', 'router-restart-test.item router-restart-test.item');
    await insertAndRemoveAsTheRoutersStop(element);

    expect(owner.item).to.equal(null);
  });

  it('should not bind an action on a removed element from the tokens being delivered as the router stopped', async () => {
    const element = document.createElement('button');
    element.setAttribute('data-target', 'router-restart-test.item');
    element.setAttribute('data-action', 'click->router-restart-test#handle');
    await insertAndRemoveAsTheRoutersStop(element);

    element.click();
    expect(owner.handle.called).to.be.false;
  });
});
