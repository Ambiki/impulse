import { expect } from '@open-wc/testing';
import Sinon from 'sinon';
import { ImpulseElement, registerElement, target } from '../../src';
import { fixture, recordEvents } from '../../src/testing';
import { mount, rejectionOf, unmountAll } from './support';

function dispatch(target: EventTarget, type: string, init: EventInit = {}): Event {
  const event = new Event(type, init);
  target.dispatchEvent(event);
  return event;
}

describe('recordEvents', () => {
  afterEach(() => unmountAll());

  it('records the events of the given types that reach the target, in the order they were dispatched', () => {
    const element = mount('<div></div>');
    const recording = recordEvents(element, ['record:a', 'record:b']);

    const first = dispatch(element, 'record:b');
    dispatch(element, 'record:other');
    const second = dispatch(element, 'record:a');
    const third = dispatch(element, 'record:b');

    expect(recording.events).to.eql([first, second, third]);
    expect(recording.types).to.eql(['record:b', 'record:a', 'record:b']);
  });

  it('records nothing dispatched before it started', () => {
    const element = mount('<div></div>');
    dispatch(element, 'record:a');

    const recording = recordEvents(element, ['record:a']);
    expect(recording.types).to.eql([]);
  });

  it('keeps the events array it hands out up to date', () => {
    const element = mount('<div></div>');
    const recording = recordEvents(element, ['record:a']);
    const { events } = recording;

    dispatch(element, 'record:a');
    expect(events).to.have.length(1);
    expect(recording.events).to.equal(events);
  });

  it('keeps events bubbling up from descendants, and the target\'s own that do not bubble', () => {
    const element = mount('<div><p></p></div>');
    const child = element.querySelector('p')!;
    const recording = recordEvents(element, ['record:a', 'record:b', 'record:c']);

    dispatch(child, 'record:a', { bubbles: true });
    dispatch(child, 'record:b');
    dispatch(element, 'record:c');

    expect(recording.types).to.eql(['record:a', 'record:c']);
  });

  it('keeps only the events the target dispatched when `self` is set', () => {
    const element = mount('<div><p></p></div>');
    const child = element.querySelector('p')!;
    const recording = recordEvents(element, ['record:a', 'record:b'], { self: true });

    dispatch(child, 'record:a', { bubbles: true });
    dispatch(element, 'record:b', { bubbles: true });

    expect(recording.types).to.eql(['record:b']);
  });

  it('keeps an event that a listener stops from going further', () => {
    const element = mount('<div><p></p></div>');
    const child = element.querySelector('p')!;
    child.addEventListener('record:a', (event) => event.stopPropagation());
    element.addEventListener('record:b', (event) => event.stopImmediatePropagation());
    const recording = recordEvents(element, ['record:a', 'record:b']);

    dispatch(child, 'record:a', { bubbles: true });
    dispatch(element, 'record:b');

    expect(recording.types).to.eql(['record:a', 'record:b']);
  });

  it('records on the window and the document', () => {
    const onWindow = recordEvents(window, ['record:a']);
    const onDocument = recordEvents(document, ['record:a']);

    dispatch(mount('<div></div>'), 'record:a', { bubbles: true });

    expect(onWindow.types).to.eql(['record:a']);
    expect(onDocument.types).to.eql(['record:a']);
  });

  it('rejects types that are not an array', () => {
    const element = mount('<div></div>');

    expect(() => recordEvents(element, 'record:a' as unknown as string[])).to.throw(
      TypeError,
      'recordEvents() takes the event types as an array, not string.',
    );
  });

  describe('waitFor', () => {
    it('resolves at once with an event dispatched before the call', async () => {
      const element = mount('<div></div>');
      const recording = recordEvents(element, ['record:a']);
      const event = dispatch(element, 'record:a');

      expect(await recording.waitFor('record:a')).to.equal(event);
    });

    it('resolves with an event dispatched after the call', async () => {
      const element = mount('<div></div>');
      const recording = recordEvents(element, ['record:a', 'record:b']);

      const waiting = recording.waitFor('record:b');
      dispatch(element, 'record:a');
      const event = dispatch(element, 'record:b');

      expect(await waiting).to.equal(event);
    });

    it('hands out each event once, earliest first', async () => {
      const element = mount('<div></div>');
      const recording = recordEvents(element, ['record:a']);
      const first = dispatch(element, 'record:a');

      const waits = [recording.waitFor('record:a'), recording.waitFor('record:a'), recording.waitFor('record:a')];
      const second = dispatch(element, 'record:a');
      const third = dispatch(element, 'record:a');

      expect(await Promise.all(waits)).to.eql([first, second, third]);
    });

    it('rejects at the deadline, naming the type and what was recorded', async () => {
      const element = mount('<div></div>');
      const recording = recordEvents(element, ['record:a', 'record:b']);
      dispatch(element, 'record:a');
      dispatch(element, 'record:a');

      const error = await rejectionOf(recording.waitFor('record:b', { timeout: 50 }));
      expect(error.message).to.equal('No "record:b" within 50ms. Recorded: record:a, record:a.');
    });

    it('says when nothing was recorded', async () => {
      const recording = recordEvents(mount('<div></div>'), ['record:a']);

      const error = await rejectionOf(recording.waitFor('record:a', { timeout: 0 }));
      expect(error.message).to.equal('No "record:a" within 0ms. Recorded: none.');
    });

    it('rejects at once for a type it does not record', async () => {
      const recording = recordEvents(mount('<div></div>'), ['record:a', 'record:b']);

      const error = await rejectionOf(recording.waitFor('record:c'));
      expect(error.message).to.equal('"record:c" is not one of the types recorded: record:a, record:b.');
    });

    it('keeps to its deadline with fake timers', async () => {
      const recording = recordEvents(mount('<div></div>'), ['record:a']);
      const clock = Sinon.useFakeTimers();
      try {
        const error = await rejectionOf(recording.waitFor('record:a', { timeout: 20 }));
        expect(error.message).to.equal('No "record:a" within 20ms. Recorded: none.');
      } finally {
        clock.restore();
      }
    });
  });

  describe('stop', () => {
    it('records nothing more', () => {
      const element = mount('<div></div>');
      const recording = recordEvents(element, ['record:a']);
      dispatch(element, 'record:a');

      recording.stop();
      dispatch(element, 'record:a');
      expect(recording.types).to.eql(['record:a']);
    });

    it('rejects a wait still pending', async () => {
      const recording = recordEvents(mount('<div></div>'), ['record:a']);

      const waiting = recording.waitFor('record:a');
      recording.stop();

      const error = await rejectionOf(waiting);
      expect(error.message).to.equal('No "record:a" before the recording was stopped. Recorded: none.');
    });

    it('still hands out an event recorded before it', async () => {
      const element = mount('<div></div>');
      const recording = recordEvents(element, ['record:a']);
      const event = dispatch(element, 'record:a');

      recording.stop();
      expect(await recording.waitFor('record:a')).to.equal(event);
      const error = await rejectionOf(recording.waitFor('record:a'));
      expect(error.message).to.equal('No "record:a" before the recording was stopped. Recorded: record:a.');
    });
  });

  it('records what an Impulse element emits', async () => {
    @registerElement('record-accordion-item')
    class RecordAccordionItem extends ImpulseElement {
      @target() toggleButton: HTMLButtonElement;
      @target() panel: HTMLElement;

      toggle() {
        this.emit('show');
        this.panel.hidden = false;
        // Shown in a later task, as a transition would.
        setTimeout(() => this.emit('shown'), 10);
      }
    }

    const accordion = await fixture<RecordAccordionItem>(`
      <record-accordion-item>
        <button data-target="record-accordion-item.toggleButton" data-action="click->record-accordion-item#toggle">
          Options
        </button>
        <div data-target="record-accordion-item.panel" hidden></div>
      </record-accordion-item>
    `);

    const recording = recordEvents(accordion, ['record-accordion-item:show', 'record-accordion-item:shown']);
    accordion.toggleButton.click();
    await recording.waitFor('record-accordion-item:shown');

    expect(recording.types).to.eql(['record-accordion-item:show', 'record-accordion-item:shown']);
    expect(accordion.panel.hidden).to.be.false;
  });
});
