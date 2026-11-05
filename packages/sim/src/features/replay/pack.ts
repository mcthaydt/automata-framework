// A `.replay` file is raw deflate over the encoded bytes (M2.3 spec §3.5). The sim imports neither zlib nor
// CompressionStream: callers pass an adapter (testing/sim has one for Node and one for browsers).
import { decodeReplay, encodeReplay } from './codec'
import { ReplayFormatError } from './errors'
import type { Replay } from './replay'

/**
 * The deflate and inflate a `.replay` file needs. The sim imports no compression library, so callers pass an
 * adapter (testing/sim has one for Node and one for browsers).
 */
export interface ReplayCompression {
  deflate(bytes: Uint8Array): Promise<Uint8Array>
  /** Rejects once the output would pass maxBytes, without inflating the rest. */
  inflate(bytes: Uint8Array, maxBytes: number): Promise<Uint8Array>
}

/** Larger than FloorFifty's 1 MiB because goldens carry reference snapshots; player replays may pass less. */
export const REPLAY_INFLATE_MAX_BYTES: number = 8 * 1024 * 1024

/** Encodes a replay and deflates it into `.replay` file bytes. */
export async function packReplay(replay: Replay, compression: ReplayCompression): Promise<Uint8Array> {
  return compression.deflate(encodeReplay(replay))
}

/**
 * Inflates `.replay` file bytes and decodes them. Throws `ReplayFormatError` for bytes that are not a
 * deflated replay or that inflate past `maxInflatedBytes` (default `REPLAY_INFLATE_MAX_BYTES`).
 */
export async function unpackReplay(
  bytes: Uint8Array,
  compression: ReplayCompression,
  options: { readonly maxInflatedBytes?: number } = {},
): Promise<Replay> {
  const max = options.maxInflatedBytes ?? REPLAY_INFLATE_MAX_BYTES
  let inflated: Uint8Array
  try {
    inflated = await compression.inflate(bytes, max)
  } catch (err) {
    if (err instanceof ReplayFormatError) throw err
    throw new ReplayFormatError('not a deflated replay', undefined, { cause: err })
  }
  // Belt and braces: an adapter that ignored the cap must not hand an oversized replay to the decoder.
  if (inflated.length > max) throw new ReplayFormatError(`inflates past ${max} bytes`)
  return decodeReplay(inflated)
}
