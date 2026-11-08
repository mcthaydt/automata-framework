// The share link (spec §5.6): `#code=1.<payload>`, where `1` is the format and the payload is the UTF-8 source,
// compressed with deflate-raw, in base64url. The decoded text is only ever text: it goes into the editor and the frame.

/** Decoding stops at this many decompressed bytes (§5.7). */
export const MAX_SHARED_SOURCE_BYTES = 65_536
/** A fragment longer than this is refused before it is decoded (§5.7). */
export const MAX_FRAGMENT_CHARS = 32_768

const PREFIX = 'code=1.'

/** A `#code=` fragment that could not be read: corrupted, oversized, too long or of an unknown format. */
export class ShareError extends Error {}

function toBase64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromBase64url(text: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(text) || text.length % 4 === 1) throw new ShareError('not base64url')
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

/** The fragment, without its `#`, that carries `source`. */
export async function encodeShare(source: string): Promise<string> {
  const stream = new Blob([new TextEncoder().encode(source)])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'))
  return PREFIX + toBase64url(new Uint8Array(await new Response(stream).arrayBuffer()))
}

/** The source a `location.hash` carries; `undefined` when it carries none. Throws `ShareError` when it can't be read. */
export async function decodeShare(hash: string): Promise<string | undefined> {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  if (!fragment.startsWith('code=')) return undefined
  if (fragment.length > MAX_FRAGMENT_CHARS) throw new ShareError('the fragment is too long')
  if (!fragment.startsWith(PREFIX)) throw new ShareError('an unknown format')
  const compressed = fromBase64url(fragment.slice(PREFIX.length))
  const reader = new Blob([compressed])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
    .getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_SHARED_SOURCE_BYTES) {
        void reader.cancel()
        throw new ShareError('the code is too long')
      }
      chunks.push(value)
    }
  } catch (error) {
    throw error instanceof ShareError ? error : new ShareError('corrupted')
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new ShareError('not UTF-8')
  }
}
