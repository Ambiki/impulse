// capture nos:                1               2                 3    4
const descriptorPattern = /^(?:(.+?)?(?:@(window|document))?->)?(.+)#(.+)?$/;

export function parseActionDescriptor(_descriptor: string) {
  const descriptor = _descriptor.trim();
  const [, eventName, eventTarget, identifier, methodName] = descriptor.match(descriptorPattern) || [];

  return {
    eventName,
    eventTarget: getEventTarget(eventTarget),
    methodName,
    identifier,
  };
}

function getEventTarget(target: string | undefined) {
  if (target === 'window') {
    return window;
  } else if (target === 'document') {
    return document;
  }
}
