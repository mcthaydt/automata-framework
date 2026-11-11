// Footsteps by floor: the audio file's `steps` table maps a floor surface (a sector's `floorTexture`) to the cue a step on it
// makes, with a default for a surface the table does not name. The game's view asks `stepCue` when it hears its own step
// event and plays what it is given; the synth and the sim are unchanged.
import type { StepsTable } from '../../shared/audio.schema.ts'

export type { StepsTable }

/** The cue for a step on `floor`; the table's default when it has no row for it (or no floor is known); nothing with no table. */
export function stepCue(table: StepsTable | undefined, floor: string | undefined): string | undefined {
  if (table === undefined) return undefined
  // Own members only: a floor named `constructor` is not the object's method.
  const row =
    floor !== undefined && Object.hasOwn(table.floors ?? {}, floor) ? table.floors?.[floor] : undefined
  return row ?? table.default
}
