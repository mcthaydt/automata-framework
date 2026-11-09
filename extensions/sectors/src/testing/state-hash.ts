// A hash of a sim's state that ignores the snapshot header's schema hash. The header carries a hash of every resource's
// schema, so it moves whenever a schema's wording does; the bytes after it are the state itself. A test that pins
// "nothing but the schema moved" hashes these.

import type { Sim } from '@automata/sim'
import { hex64, xxhash64 } from '@automata/sim/hash'

/** The `schemaHash` field of a snapshot's header: bytes 6 to 14. */
const SCHEMA_HASH = { from: 6, to: 14 } as const

/** The state's bytes as a 16-digit hash, with the header's schema hash zeroed. */
export function stateHash(sim: Sim): string {
  const bytes = sim.snapshot().slice()
  bytes.fill(0, SCHEMA_HASH.from, SCHEMA_HASH.to)
  return hex64(xxhash64(bytes))
}
