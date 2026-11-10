/** A `data-target` token (`identifier.key`) split into its two segments. */
export interface TargetDescriptor {
  identifier: string | undefined;
  key: string | undefined;
}

/**
 * Parses a `data-target` token (`identifier.key`) into its two segments. Any segment past the key is ignored, and a
 * missing key comes back `undefined`. The target router parses each token through here once, when it is matched,
 * picks its Owner by the identifier and hands the descriptor to the Owner's `Target`; `Target` also reads the keys of
 * the tokens it holds through here.
 */
export function parseTargetDescriptor(descriptor: string): TargetDescriptor {
  const [identifier, key] = descriptor.split('.');
  return { identifier, key };
}
