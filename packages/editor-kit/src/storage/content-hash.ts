/**
 * The SHA-256 of `bytes` as lowercase hex: how the storage layer tells two versions of a file apart when their
 * modification times cannot (a clock with whole seconds), without keeping a copy of either. `crypto.subtle` needs a
 * secure context, which OPFS and File System Access need too.
 */
export async function contentHash(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice()))
  let hex = ''
  for (const byte of digest) hex += byte.toString(16).padStart(2, '0')
  return hex
}
