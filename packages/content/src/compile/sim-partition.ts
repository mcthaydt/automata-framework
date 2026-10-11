// The sim partition (M2.2 spec §3.1–§3.2): the part of the compiled content the sim receives, and whose hash
// gates snapshots and replays.
//
// FloorFifty kept two revisions: `rulesetRevision` moved only with what the simulation reads, and
// `contentRevision` with everything (packages/content/src/revisions.ts, 122a220). AF keeps the same split, but
// partitions by kind instead of by field: `tuning` and every kind registered with `sim: true` (the default)
// go to the sim; `flow`, `palette`, `game`, `assets` and kinds registered `{ sim: false }` do not. So a store
// listing, a colour or a preload change never refuses a save, and a room or a tuning change always does.

import type { Problem } from '../diagnostics/diagnostic'
import type { ContentData } from '../generate/content-generator'
import { contentHash } from '../hash/content-hash'
import type { ContentSchemaDef } from '../schema/content-schema'
import type { FoundRef } from '../schema/references'

export interface SimPartition {
  /** `tuning` and each sim kind, the same objects as in the full data. */
  readonly data: ContentData
  /** `contentHash(data)`: exactly what `createSim` computes from the same data. */
  readonly hash: string
}

export function simPartition(data: ContentData, schemas: readonly ContentSchemaDef[]): SimPartition {
  // `tuning` is always present (`{}` without a tuning.toml), so the shape never depends on that file existing.
  const sim: Record<string, unknown> = { tuning: data.tuning ?? {} }
  for (const def of schemas) {
    if (def.sim && data[def.kind] !== undefined) sim[def.kind] = data[def.kind]
  }
  return { data: sim, hash: contentHash(sim) }
}

/**
 * A reference from a sim kind to a non-sim kind. The sim would hold an ID whose target it cannot read, and a
 * change to that target would not move the sim hash, so it is refused. References from non-sim kinds into
 * sim content are fine: display data may point at the gameplay item it decorates.
 */
export function simReferenceProblems(
  fromKind: string,
  refs: readonly FoundRef[],
  schemas: readonly ContentSchemaDef[],
): Problem[] {
  const simKinds = new Set(schemas.filter((def) => def.sim).map((def) => def.kind))
  if (!simKinds.has(fromKind)) return []
  return refs
    .filter((ref) => !simKinds.has(ref.kind))
    .map((ref) => ({
      path: ref.path,
      code: 'simReference' as const,
      message: `${fromKind} is sim content but ${ref.kind} is not; mark ${ref.kind} { sim: true } or keep the reference out of the sim`,
    }))
}
