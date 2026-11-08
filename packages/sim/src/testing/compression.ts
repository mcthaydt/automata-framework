// Deflate adapters for `.replay` files: Node's zlib and the web's CompressionStream, both raw
// deflate, so each reads the other's bytes. Both stop inflating once the output passes the cap, so a small
// file cannot expand into gigabytes.
import { type ReplayCompression, ReplayFormatError } from '@mcthaydt/automata-sim/replay'

const pastCap = (maxBytes: number): ReplayFormatError =>
  new ReplayFormatError(`inflates past ${maxBytes} bytes`)

/** Node only. zlib is imported when first used, so importing this module in a browser costs nothing. */
export const nodeCompression: ReplayCompression = {
  async deflate(bytes) {
    const zlib = await import('node:zlib')
    return new Uint8Array(zlib.deflateRawSync(bytes))
  },
  async inflate(bytes, maxBytes) {
    const zlib = await import('node:zlib')
    try {
      return new Uint8Array(zlib.inflateRawSync(bytes, { maxOutputLength: maxBytes }))
    } catch (err) {
      // maxOutputLength makes zlib stop and throw a RangeError (ERR_BUFFER_TOO_LARGE) instead of growing.
      if ((err as { code?: string }).code === 'ERR_BUFFER_TOO_LARGE') throw pastCap(maxBytes)
      throw err
    }
  },
}

async function readAll(stream: ReadableStream<Uint8Array>, maxBytes: number): Promise<Uint8Array> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.length
    if (length > maxBytes) {
      await reader.cancel()
      throw pastCap(maxBytes)
    }
    chunks.push(value)
  }
  const out = new Uint8Array(length)
  let at = 0
  for (const chunk of chunks) {
    out.set(chunk, at)
    at += chunk.length
  }
  return out
}

/** Browsers and Node: CompressionStream / DecompressionStream('deflate-raw'). */
export const streamCompression: ReplayCompression = {
  async deflate(bytes) {
    const stream = new Blob([bytes as Uint8Array<ArrayBuffer>])
      .stream()
      .pipeThrough(new CompressionStream('deflate-raw'))
    return readAll(stream, Number.MAX_SAFE_INTEGER)
  },
  async inflate(bytes, maxBytes) {
    const stream = new Blob([bytes as Uint8Array<ArrayBuffer>])
      .stream()
      .pipeThrough(new DecompressionStream('deflate-raw'))
    return readAll(stream, maxBytes)
  },
}
