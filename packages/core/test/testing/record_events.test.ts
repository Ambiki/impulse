import { expect } from '@open-wc/testing';
import Sinon from 'sinon';
import { ImpulseElement, registerElement, target } from '../../src';
import { fixture, recordEvents } from '../../src/testing';
import { appendMarkup, rejectionOf, removeAppended } from './support';

// A Recording takes its types from the event map, as `addEventListener` does, so the events these tests dispatch are
// declared the way an application declares its own.
declare global {
  interface GlobalEventHandlersEventMap {
    'record:a': Event;
    'record:b': Event;
    'record:c': Event;
    'record:d': Event;
    'record:other': Event;
    'record:detail': CustomEvent<{ id: number }>;
    'record-accordion-item:show': CustomEvent<Record<string, never>>;
    'record-accordion-item:shown': CustomEvent<Record<string, never>>;
  }
}

/** Compiles only when `A` and `B` are the same type. */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

function dispatch(target: EventTarget, type: string, init: EventInit = {}): Event {
  const event = new Event(type, init);
  target.dispatchEvent(event);
  return event;
}

describe('recordEvents', () => {
  afterEach(() => removeAppended());

  it('records the events of the given types that reach the target, in the order they were dispatched', () => {
    const element = appendMarkup('<div></div>');
    const recording = recordEvents(element, ['record:a', 'record:b']);

    const first = dispatch(element, 'record:b');
    dispatch(element, 'record:other');
    const second = dispatch(element, 'record:a');
    const third = dispatch(element, 'record:b');

    expect(recording.events).to.eql([first, second, third]);
    expect(recording.types).to.eql(['record:b', 'record:a', 'record:b']);
  });

  it('records nothing dispatched before it started', () => {
    const element = appendMarkup('<div></div>');
    dispatch(element, 'record:a');

    const recording = recordEvents(element, ['record:a']);
    expect(recording.types).to.eql([]);
  });

  it('keeps the events array it hands out up to date', () => {
    const element = appendMarkup('<div></div>');
    const recording = recordEvents(element, ['record:a']);
    const { events } = recording;

    dispatch(element, 'record:a');
    expect(events).to.have.length(1);
    expect(recording.events).to.equal(events);
  });

  it('keeps events bubbling up from descendants, and the target\'s own that do not bubble', () => {
    const element = appendMarkup('<div><p></p></div>');
    const child = element.querySelector('p')!;
    const recording = recordEvents(element, ['record:a', 'record:b', 'record:c']);

    dispatch(child, 'record:a', { bubbles: true });
    dispatch(child, 'record:b');
    dispatch(element, 'record:c');

    expect(recording.types).to.eql(['record:a', 'record:c']);
  });

  it('keeps only the events the target dispatched when `self` is set', () => {
    const element = appendMarkup('<div><p></p></div>');
    const child = element.querySelector('p')!;
    const recording = recordEvents(element, ['record:a', 'record:b'], { self: true });

    dispatch(child, 'record:a', { bubbles: true });
    dispatch(element, 'record:b', { bubbles: true });

    expect(recording.types).to.eql(['record:b']);
  });

  it('keeps an event that a listener stops from going further', () => {
    const element = appendMarkup('<div><p></p></div>');
    const child = element.querySelector('p')!;
    child.addEventListener('record:a', (event) => event.stopPropagation());
    element.addEventListener('record:b', (event) => event.stopImmediatePropagation());
    const recording = recordEvents(element, ['record:a', 'record:b']);

    dispatch(child, 'record:a', { bubbles: true });
    dispatch(element, 'record:b');

    expect(recording.types).to.eql(['record:a', 'record:b']);
  });

  it('records an event ahead of one a listener dispatches while handling it', () => {
    const element = appendMarkup('<div><p></p></div>');
    const child = element.querySelector('p')!;
    child.addEventListener('record:a', () => dispatch(element, 'record:b'));
    element.addEventListener('record:c', () => dispatch(element, 'record:d'));
    const recording = recordEvents(element, ['record:a', 'record:b', 'record:c', 'record:d']);

    dispatch(child, 'record:a', { bubbles: true });
    dispatch(element, 'record:c');

    expect(recording.types).to.eql(['record:a', 'record:b', 'record:c', 'record:d']);
  });

  it('records on the window and the document', () => {
    const onWindow = recordEvents(window, ['record:a']);
    const onDocument = recordEvents(document, ['record:a']);

    dispatch(appendMarkup('<div></div>'), 'record:a', { bubbles: true });

    expect(onWindow.types).to.eql(['record:a']);
    expect(onDocument.types).to.eql(['record:a']);
  });

  it('rejects types that are not an array', () => {
    const element = appendMarkup('<div></div>');

    expect(() => recordEvents(element, 'record:a' as never)).to.throw(
      TypeError,
      'recordEvents() takes the event types as an array, not string.',
    );
  });

  describe('types', () => {
    it('types the events and their types by the event map', () => {
      const element = appendMarkup('<div></div>');
      const recording = recordEvents(element, ['record:a', 'record:detail']);
      element.dispatchEvent(new CustomEvent('record:detail', { detail: { id: 7 } }));

      const typed: [
        Equal<typeof recording.events, (Event | CustomEvent<{ id: number }>)[]>,
        Equal<typeof recording.types, ('record:a' | 'record:detail')[]>,
      ] = [true, true];
      expect(typed).to.eql([true, true]);
      expect(recording.types).to.eql(['record:detail']);
    });

    it('needs no cast to read the `detail` of a custom event', () => {
      const element = appendMarkup('<div></div>');
      const recording = recordEvents(element, ['record:detail']);
      element.dispatchEvent(new CustomEvent('record:detail', { detail: { id: 7 } }));
      element.dispatchEvent(new CustomEvent('record:detail', { detail: { id: 8 } }));

      expect(recording.events.map((event) => event.detail.id)).to.eql([7, 8]);
    });

    it('takes the event types the target is sent', () => {
      const element = appendMarkup('<div></div>');
      const onWindow = recordEvents(window, ['storage', 'record:a']);
      const onDocument = recordEvents(document, ['visibilitychange', 'record:a']);
      const onElement = recordEvents(element, ['keydown', 'fullscreenchange', 'record:a']);
      const onFragment = recordEvents(document.createDocumentFragment(), ['keydown', 'record:a']);

      const typed: [
        Equal<typeof onWindow.events, (StorageEvent | Event)[]>,
        Equal<typeof onDocument.events, Event[]>,
        Equal<typeof onElement.events, (KeyboardEvent | Event)[]>,
        Equal<typeof onFragment.events, (KeyboardEvent | Event)[]>,
      ] = [true, true, true, true];
      expect(typed).to.eql([true, true, true, true]);

      dispatch(element, 'record:a', { bubbles: true });
      expect([onWindow.types, onDocument.types, onElement.types, onFragment.types]).to.eql([
        ['record:a'],
        ['record:a'],
        ['record:a'],
        [],
      ]);
    });

    it('takes the event types a media element is sent', () => {
      const video = appendMarkup<HTMLVideoElement>('<video></video>');
      const audio = appendMarkup<HTMLAudioElement>('<audio></audio>');
      const onVideo = recordEvents(video, ['enterpictureinpicture', 'encrypted']);
      const onAudio = recordEvents(audio, ['encrypted']);

      const typed: [
        Equal<typeof onVideo.events, (PictureInPictureEvent | MediaEncryptedEvent)[]>,
        Equal<typeof onAudio.events, MediaEncryptedEvent[]>,
      ] = [true, true];
      expect(typed).to.eql([true, true]);

      dispatch(video, 'encrypted');
      expect([onVideo.types, onAudio.types]).to.eql([['encrypted'], []]);
    });

    it('takes the event types a shadow root is sent', () => {
      const shadowRoot = appendMarkup('<div></div>').attachShadow({ mode: 'open' });
      const recording = recordEvents(shadowRoot, ['slotchange', 'keydown']);

      const typed: Equal<typeof recording.events, (Event | KeyboardEvent)[]> = true;
      expect(typed).to.be.true;

      dispatch(shadowRoot, 'slotchange');
      expect(recording.types).to.eql(['slotchange']);
    });

    it('does not compile with a type the event map does not declare', () => {
      const element = appendMarkup('<div></div>');

      // @ts-expect-error A misspelled type is not in the event map.
      const recording = recordEvents(element, ['record:a', 'record:misspelled']);
      // @ts-expect-error An element is not sent a window's `storage`.
      recordEvents(element, ['storage']);
      // @ts-expect-error Nor is `<body>`, though its `addEventListener()` takes the window's own events.
      recordEvents(document.body, ['popstate']);
      expect(recording.types).to.eql([]);
    });
  });

  describe('waitFor', () => {
    it('resolves at once with an event dispatched before the call', async () => {
      const element = appendMarkup('<div></div>');
      const recording = recordEvents(element, ['record:a']);
      const event = dispatch(element, 'record:a');
      // Due before any task the wait could start, so it has run by then if the wait took one.
      let taskRan = false;
      setTimeout(() => {
        taskRan = true;
      }, 0);

      expect(await recording.waitFor('record:a')).to.equal(event);
      expect(taskRan).to.be.false;
    });

    it('resolves with an event dispatched after the call', async () => {
      const element = appendMarkup('<div></div>');
      const recording = recordEvents(element, ['record:a', 'record:b']);

      const waiting = recording.waitFor('record:b');
      dispatch(element, 'record:a');
      const event = dispatch(element, 'record:b');

      expect(await waiting).to.equal(event);
    });

    it('resolves with the event as the event map types it', async () => {
      const element = appendMarkup('<div></div>');
      const recording = recordEvents(element, ['record:a', 'record:detail']);
      element.dispatchEvent(new CustomEvent('record:detail', { detail: { id: 7 } }));

      const event = await recording.waitFor('record:detail');
      const typed: Equal<typeof event, CustomEvent<{ id: number }>> = true;
      expect(typed).to.be.true;
      expect(event.detail.id).to.equal(7);
    });

    it('hands out each event once, earliest first', async () => {
      const element = appendMarkup('<div></div>');
      const recording = recordEvents(element, ['record:a']);
      const first = dispatch(element, 'record:a');

      const waits = [recording.waitFor('record:a'), recording.waitFor('record:a'), recording.waitFor('record:a')];
      const second = dispatch(element, 'record:a');
      const third = dispatch(element, 'record:a');

      expect(await Promise.all(waits)).to.eql([first, second, third]);
    });

    // The browser runs microtasks between the listeners of an event it dispatches itself, such as `toggle`. A wait that
    // resolved while the event was still being dispatched would resume the test ahead of the listeners yet to run.
    it('resolves once every listener has run, for an event the browser dispatches', async () => {
      const details = appendMarkup<HTMLDetailsElement>('<details><summary>Options</summary></details>');
      const order: string[] = [];
      details.addEventListener('toggle', () => order.push('listener'));
      const recording = recordEvents(details, ['toggle']);

      details.open = true;
      await recording.waitFor('toggle');
      expect(order).to.eql(['listener']);
    });

    it('resolves once every listener has run, when called while the event is being dispatched', async () => {
      const details = appendMarkup<HTMLDetailsElement>('<details><summary>Options</summary></details>');
      const order: string[] = [];
      const recording = recordEvents(details, ['toggle']);
      // A capturing listener added after the Recording's: the event is recorded by now, and the listener below it has
      // yet to run.
      const resumed = new Promise<void>((resolve) => {
        details.addEventListener('toggle', () => {
          void recording.waitFor('toggle').then(() => {
            order.push('test');
            resolve();
          });
        }, true);
      });
      details.addEventListener('toggle', () => order.push('listener'));

      details.open = true;
      await resumed;
      expect(order).to.eql(['listener', 'test']);
    });

    it('rejects at the deadline, naming the type and what was recorded', async () => {
      const element = appendMarkup('<div></div>');
      const recording = recordEvents(element, ['record:a', 'record:b']);
      dispatch(element, 'record:a');
      dispatch(element, 'record:a');

      const error = await rejectionOf(recording.waitFor('record:b', { timeout: 50 }));
      expect(error.message).to.equal('No "record:b" within 50ms. Recorded: record:a, record:a.');
    });

    it('says when nothing was recorded', async () => {
      const recording = recordEvents(appendMarkup('<div></div>'), ['record:a']);

      const error = await rejectionOf(recording.waitFor('record:a', { timeout: 0 }));
      expect(error.message).to.equal('No "record:a" within 0ms. Recorded: none.');
    });

    it('rejects at once for a type it does not record', async () => {
      const recording = recordEvents(appendMarkup('<div></div>'), ['record:a', 'record:b']);

      // @ts-expect-error The Recording does not keep `record:c`, which is also an error at compile time.
      const error = await rejectionOf(recording.waitFor('record:c'));
      expect(error.message).to.equal('"record:c" is not one of the types recorded: record:a, record:b.');
    });

    it('keeps to its deadline with fake timers', async () => {
      const recording = recordEvents(appendMarkup('<div></div>'), ['record:a']);
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
      const element = appendMarkup('<div></div>');
      const recording = recordEvents(element, ['record:a']);
      dispatch(element, 'record:a');

      recording.stop();
      dispatch(element, 'record:a');
      expect(recording.types).to.eql(['record:a']);
    });

    it('rejects a wait still pending', async () => {
      const recording = recordEvents(appendMarkup('<div></div>'), ['record:a']);

      const waiting = recording.waitFor('record:a');
      recording.stop();

      const error = await rejectionOf(waiting);
      expect(error.message).to.equal('No "record:a" before the recording was stopped. Recorded: none.');
    });

    it('still hands out an event recorded before it', async () => {
      const element = appendMarkup('<div></div>');
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
