/**
 * Parses a `data-target` token (`identifier.key`) into its two segments. Any segment past the key is ignored, and a
 * missing key comes back `undefined`. Every consumer of a target token, the router that picks its owner and the
 * `Target` delegate that validates it, must parse through here so they always agree on the identifier.
 */
export function parseTargetDescriptor(descriptor: string) {
  const [identifier, key] = descriptor.split('.');
  return { identifier, key };
}
