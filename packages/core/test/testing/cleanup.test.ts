import { expect } from '@open-wc/testing';
import { ImpulseElement, isInitialized } from '../../src';
import { cleanup, fixture, recordEvents, whenSettled } from '../../src/testing';
import { defineImpulseElement, rejectionOf } from './support';

declare global {
  interface GlobalEventHandlersEventMap {
    'cleanup:removed': Event;
    'cleanup:after': Event;
  }
}

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

  it('stops every Recording before removing the fixtures', async () => {
    // An element that announces its own removal, which a Recording still running would record.
    const tag = defineImpulseElement('cleanup-announced', class extends ImpulseElement {
      disconnected() {
        this.dispatchEvent(new Event('cleanup:removed'));
      }
    });
    const element = await fixture(`<${tag}></${tag}>`);
    const onElement = recordEvents(element, ['cleanup:removed']);
    const onDocument = recordEvents(document, ['cleanup:after']);
    const waiting = onDocument.waitFor('cleanup:after');

    cleanup();
    document.dispatchEvent(new Event('cleanup:after'));
    expect(onElement.types).to.eql([]);
    expect(onDocument.types).to.eql([]);
    const error = await rejectionOf(waiting);
    expect(error.message).to.equal('No "cleanup:after" before the recording was stopped. Recorded: none.');
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
