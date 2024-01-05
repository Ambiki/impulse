import { expect } from '@open-wc/testing';
import { parseActionDescriptor } from '../src/action_descriptor';

describe('Action descriptor', () => {
  it('parses the descriptor string', () => {
    const descriptor = parseActionDescriptor('click->element-name#toggle');

    expect(descriptor.eventName).to.eq('click');
    expect(descriptor.eventModifiers).to.eql([]);
    expect(descriptor.eventListenerOptions).to.eql({});
    expect(descriptor.identifier).to.eq('element-name');
    expect(descriptor.methodName).to.eq('toggle');
    expect(descriptor.eventTarget).to.be.undefined;
  });

  it('identifies the event target', () => {
    const descriptor1 = parseActionDescriptor('click@window->element-name#toggle');
    expect(descriptor1.eventName).to.eq('click');
    expect(descriptor1.eventModifiers).to.eql([]);
    expect(descriptor1.eventListenerOptions).to.eql({});
    expect(descriptor1.identifier).to.eq('element-name');
    expect(descriptor1.methodName).to.eq('toggle');
    expect(descriptor1.eventTarget).to.eq(window);

    const descriptor2 = parseActionDescriptor('click@document->element-name#toggle');
    expect(descriptor2.eventName).to.eq('click');
    expect(descriptor2.eventModifiers).to.eql([]);
    expect(descriptor2.eventListenerOptions).to.eql({});
    expect(descriptor2.identifier).to.eq('element-name');
    expect(descriptor2.methodName).to.eq('toggle');
    expect(descriptor2.eventTarget).to.eq(document);

    const descriptor3 = parseActionDescriptor('click@invalid->element-name#toggle');
    expect(descriptor3.eventTarget).to.be.undefined;
  });

  it('identifies event modifiers', () => {
    const descriptor1 = parseActionDescriptor('click.prevent->element-name#toggle');
    expect(descriptor1.eventName).to.eq('click');
    expect(descriptor1.eventModifiers).to.eql(['prevent']);
    expect(descriptor1.eventListenerOptions).to.eql({});
    expect(descriptor1.identifier).to.eq('element-name');
    expect(descriptor1.methodName).to.eq('toggle');
    expect(descriptor1.eventTarget).to.be.undefined;

    const descriptor2 = parseActionDescriptor('click.prevent.stop->element-name#toggle');
    expect(descriptor2.eventName).to.eq('click');
    expect(descriptor2.eventModifiers).to.eql(['prevent', 'stop']);
    expect(descriptor2.eventListenerOptions).to.eql({});
    expect(descriptor2.identifier).to.eq('element-name');
    expect(descriptor2.methodName).to.eq('toggle');
    expect(descriptor2.eventTarget).to.be.undefined;

    const descriptor3 = parseActionDescriptor('click.prevent.stop.self.invalid@window->element-name#toggle');
    expect(descriptor3.eventName).to.eq('click');
    expect(descriptor3.eventModifiers).to.eql(['prevent', 'stop', 'self']);
    expect(descriptor3.eventListenerOptions).to.eql({});
    expect(descriptor3.identifier).to.eq('element-name');
    expect(descriptor3.methodName).to.eq('toggle');
    expect(descriptor3.eventTarget).to.eq(window);
  });

  it('identifies event options', () => {
    const descriptor1 = parseActionDescriptor('click.capture->element-name#toggle');
    expect(descriptor1.eventListenerOptions).to.eql({ capture: true });

    const descriptor2 = parseActionDescriptor('click.capture.once.passive.invalid->element-name#toggle');
    expect(descriptor2.eventListenerOptions).to.eql({ capture: true, once: true, passive: true });
  });
});
