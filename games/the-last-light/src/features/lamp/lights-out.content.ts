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
 * it, so the state is the wanted level over the authored one; a lamp the level has out (or does not have) stays as it is.
 */
export function lightsOutStates(
  file: LightsOutFile,
  lamps: readonly { readonly id: string; readonly level: number }[],
): PieceStates {
  const states: Record<string, LampState> = {}
  for (const lamp of lamps) {
    const wanted = file.levels[lamp.id]
    if (wanted === undefined) continue
    states[lamp.id] = { level: lamp.level > 0 ? wanted / lamp.level : 0 }
  }
  return { ...noPieceStates(), lamps: states }
}
