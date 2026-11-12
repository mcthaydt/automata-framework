import type { LampState, PieceStates } from '@automata/3d/level'
import { noPieceStates } from '@automata/3d/level'
import { defineContentSchema } from '@automata/content/schema'
import { z } from 'zod'

// How the room's lamps burn once the lights have gone. The old game does not black the room: its dress puts each lamp at a
// level of its own, and the file `content/lights-out.toml` carries those levels so a person can change them. They are what the
// lamp burns at (the level file's `level` is what it burns at when the night begins), and they are not the sim's: only the
// picture reads them, so the kind is kept out of the sim's content and its hash.

export const lightsOutSchema = z.strictObject({
  /** The level each named lamp burns at after lights out, by the lamp's id; a lamp not named burns as the level lit it. */
  levels: z.record(z.string(), z.number().min(0)),
  /**
   * A share every lamp's level is multiplied by once the lights have gone (default 1, the levels as written). The old game shows its
   * linear light raw, so close to a lamp a wall stays dark; the framework's `srgb` light multiplies the sRGB colour and draws the same
   * lamp much brighter on the wall beside it. Play's `[light] lamps` gain was set on the lit room, so the dark room asks for its own.
   */
  dim: z.number().min(0).max(1).default(1),
})

export type LightsOutFile = z.infer<typeof lightsOutSchema>

/** The kind the game registers (vite.config.ts) to read `content/lights-out.toml`. Presentation only. */
export const lightsOutContent = defineContentSchema(
  'lights-out',
  lightsOutSchema,
  { file: 'lights-out.toml' },
  { sim: false },
)

/**
 * The pieces' states once the lights are out: each named lamp at its level. A lamp's state scales the level the level file gave
 * it, so the state is the wanted level over the authored one; a lamp the level has out (or does not have) stays as it is. `dim` multiplies every burning lamp.
 */
export function lightsOutStates(
  file: LightsOutFile,
  lamps: readonly { readonly id: string; readonly level: number }[],
): PieceStates {
  const states: Record<string, LampState> = {}
  for (const lamp of lamps) {
    const wanted = file.levels[lamp.id]
    // A lamp the file does not name burns as the level lit it, less the `dim` every lamp takes.
    if (wanted === undefined && file.dim === 1) continue
    if (lamp.level <= 0) continue
    states[lamp.id] = { level: ((wanted ?? lamp.level) * file.dim) / lamp.level }
  }
  return { ...noPieceStates(), lamps: states }
}
