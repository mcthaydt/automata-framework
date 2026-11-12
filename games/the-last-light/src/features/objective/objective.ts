import { chooseObjective, type HudFile } from '@automata/hud/content'
import type { Hotspot } from '@automata/interact/sim'
import type { Reader } from '@automata/puzzle/sim'

/** The objective: the key of its line and, when its row names a hotspot, the point to walk to. */
export interface Objective {
  readonly line: string
  readonly target: { readonly x: number; readonly z: number } | undefined
}

/**
 * The objective now: the first row of the HUD file whose conditions hold (T3: one list, in the file, not two ladders in code),
 * and the place its hotspot stands. A row that names a hotspot the level lacks has no place to point to.
 */
export function objectiveNow(
  file: HudFile,
  reader: Reader,
  hotspots: readonly Hotspot[],
): Objective | undefined {
  const row = chooseObjective(file.objective ?? [], reader)
  if (row === undefined) return undefined
  const spot = row.target === undefined ? undefined : hotspots.find((hotspot) => hotspot.id === row.target)
  return { line: row.line, target: spot === undefined ? undefined : { x: spot.x, z: spot.z } }
}
