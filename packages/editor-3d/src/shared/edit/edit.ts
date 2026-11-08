// What an edit is (ED3D spec §5.4, with the plan's decision 2 and 3): a value the editor runs against the level, not a
// kit `Command` (those take no arguments). It answers with the level it makes, or refuses with a sentence; a refusal
// changes nothing and records nothing.
import type { LevelProfile } from '../level-session/level-profile'

export type EditResult<D> =
  | {
      readonly ok: true
      readonly level: D
      /** Selection ids to select once the edit is in: a new sector, the sectors a duplicate made. */
      readonly select?: readonly string[] | undefined
    }
  | {
      readonly ok: false
      /** A sentence for the person: Last Light's own where it has one (`the new room overlaps yard`). */
      readonly reason: string
      /** The selection id the reason is about, so a view can frame it (the sector that was overlapped). */
      readonly at?: string | undefined
    }

export interface Edit<D> {
  /** The command's name in spec §5.4: `sector.moveCorner`. */
  readonly id: string
  /** The undo label: `Move corner 2 of hall`. */
  readonly label: string
  /** Two runs with this key close together are one undo step (scrubbing one field). */
  readonly coalesce?: string | undefined
  run(profile: LevelProfile<D>, level: D): EditResult<D>
}

export function ok<D>(level: D, select?: readonly string[]): EditResult<D> {
  return select === undefined ? { ok: true, level } : { ok: true, level, select }
}

export function refuse(reason: string, at?: string): EditResult<never> {
  return at === undefined ? { ok: false, reason } : { ok: false, reason, at }
}
