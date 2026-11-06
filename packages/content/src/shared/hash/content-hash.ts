// The content hash: one XXH64 from `@mcthaydt/automata-sim/hash`, over the sim's canonical
// JSON, so the hash the compiler writes is exactly the one the sim recomputes when it checks a snapshot
//. The preimage never contains the hash itself.

import { canonicalJson, hex64, utf8, xxhash64 } from '@mcthaydt/automata-sim/hash'

/** 16 lowercase hex digits. */
export function contentHash(data: unknown): string {
  return hex64(xxhash64(utf8(canonicalJson(data))))
}
