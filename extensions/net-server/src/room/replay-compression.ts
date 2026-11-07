/**
 * The deflate a `.replay` file needs, on Node (the sim imports no compression library: `packReplay` takes an
 * adapter). Raw deflate, as core's own adapters write it, so a replay packed here unpacks in a browser.
 */

import { deflateRawSync, inflateRawSync } from 'node:zlib'
import type { ReplayCompression } from '@mcthaydt/automata-sim/replay'

export const nodeReplayCompression: ReplayCompression = {
  deflate: async (bytes) => new Uint8Array(deflateRawSync(bytes)),
  inflate: async (bytes, maxBytes) => new Uint8Array(inflateRawSync(bytes, { maxOutputLength: maxBytes })),
}
