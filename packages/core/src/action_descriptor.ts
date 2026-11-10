// https://regex101.com/r/noxreJ/1
// capture nos:                 1          2               3                 4    5
// eslint-disable-next-line regexp/no-super-linear-backtracking, regexp/optimal-quantifier-concatenation, regexp/no-misleading-capturing-group
const descriptorPattern = /(?:(.+?)?(?:\.(.+?))?(?:@(window|document))?->)?(.+)#(.+)?$/;

const validEventModifiers = ['stop', 'prevent', 'self'];
const validEventOptions = ['capture', 'once', 'passive'];

// A token that does not read as `event->identifier#method` leaves the parts it lacks `undefined`.
export interface ActionDescriptor {
  eventName: string | undefined;
  eventModifiers: readonly string[];
  eventListenerOptions: EventListenerOptions;
  eventTarget: Window | Document | undefined;
  methodName: string | undefined;
  identifier: string | undefined;
}

// The action router parses each token once, but descriptors repeat across elements (every row of a table, say), so
// each distinct descriptor is parsed once.
const descriptors = new Map<string, ActionDescriptor>();

export function parseActionDescriptor(_descriptor: string): ActionDescriptor {
  const descriptor = _descriptor.trim();
  const cached = descriptors.get(descriptor);
  if (cached) {
    return cached;
  }

  const [, eventName, modifiers, eventTarget, identifier, methodName] = descriptor.match(descriptorPattern) || [];
  const modifiersArray = modifiers?.split('.') || [];
  const eventModifiers = modifiersArray.filter((m) => validEventModifiers.includes(m));
  const parsed = {
    eventName,
    eventModifiers,
    eventListenerOptions: getEventListenerOptions(modifiersArray),
    eventTarget: getEventTarget(eventTarget),
    methodName,
    identifier,
  };
  descriptors.set(descriptor, parsed);
  return parsed;
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
