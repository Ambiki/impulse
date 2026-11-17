import { expect } from '@open-wc/testing';
import { isInitialized } from '../../src';
import { cleanup, fixture, whenSettled } from '../../src/testing';
import { defineImpulseElement } from './support';

describe('cleanup', () => {
  it('removes every fixture', async () => {
    const tag = defineImpulseElement('cleanup-removed');
    const first = await fixture(`<${tag}></${tag}>`);
    const second = await fixture('<p></p>');

    cleanup();
    expect(first.isConnected).to.be.false;
    expect(second.isConnected).to.be.false;
    expect(first.parentElement!.isConnected).to.be.false;

    await whenSettled();
    expect(isInitialized(first)).to.be.false;
  });

  it('can be called again', async () => {
    const element = await fixture('<p></p>');

    cleanup();
    cleanup();
    expect(element.isConnected).to.be.false;
  });

  it('leaves alone an element a test appended elsewhere', async () => {
    const element = await fixture('<p></p>');
    const elsewhere = document.body.appendChild(document.createElement('aside'));

    try {
      cleanup();
      expect(element.isConnected).to.be.false;
      expect(elsewhere.isConnected).to.be.true;
    } finally {
      elsewhere.remove();
    }
  });

  describe('run after each test on its own', () => {
    let leftover: Element;

    it('leaves a fixture in place', async () => {
      leftover = await fixture('<p id="cleanup-leftover"></p>');
      expect(leftover.isConnected).to.be.true;
    });

    it('finds it removed in the next test', () => {
      expect(leftover.isConnected).to.be.false;
      expect(document.getElementById('cleanup-leftover')).to.be.null;
    });
  });
});
