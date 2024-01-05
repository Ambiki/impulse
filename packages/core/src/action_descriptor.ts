// https://regex101.com/r/noxreJ/1
// capture nos:                 1          2               3                 4    5
const descriptorPattern = /(?:(.+?)?(?:\.(.+?))?(?:@(window|document))?->)?(.+)#(.+)?$/;

const validEventModifiers = ['stop', 'prevent', 'self'];
const validEventOptions = ['capture', 'once', 'passive'];

export function parseActionDescriptor(_descriptor: string) {
  const descriptor = _descriptor.trim();
  const [, eventName, modifiers, eventTarget, identifier, methodName] = descriptor.match(descriptorPattern) || [];
  const modifiersArray = modifiers?.split('.') || [];
  const eventModifiers = modifiersArray.filter((m) => validEventModifiers.includes(m));

  return {
    eventName,
    eventModifiers,
    eventListenerOptions: getEventListenerOptions(modifiersArray),
    eventTarget: getEventTarget(eventTarget),
    methodName,
    identifier,
  };
}

export const modifierGuards: Record<string, (e: Event) => boolean> = {
  prevent: (event) => Boolean(event.preventDefault()),
  stop: (event) => Boolean(event.stopPropagation()),
  self: (event) => event.target !== event.currentTarget,
};

function getEventListenerOptions(modifiers: string[]): EventListenerOptions {
  const options: EventListenerOptions = {};
  for (const modifier of modifiers) {
    if (validEventOptions.includes(modifier)) {
      options[modifier as keyof EventListenerOptions] = true;
    }
  }
  return options;
}

function getEventTarget(target: string | undefined) {
  if (target === 'window') {
    return window;
  } else if (target === 'document') {
    return document;
  }
}
