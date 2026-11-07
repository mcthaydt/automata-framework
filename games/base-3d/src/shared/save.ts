// base-3d's save: one slot under one Ruken key, its own (`base-3d-free`), so a save the adventure wrote is never read
//. Every change to the shape after the first deploy bumps `version` and adds `migrations[n]` (n → n + 1)
// with a real version-n fixture in save-fixtures/ and a test that it migrates and parses.
// Sim-free: zod and a type-only import, so `pnpm boundaries` passes it with the other state files.
import type { SaveDef } from '@automata/framework'
import { z } from 'zod'

const count = z.number().int().nonnegative()

/** The saved record; unknown fields pass through, so a later build's additions survive this build's write. */
export const base3dSaveSchema = z.looseObject({
  /** The indices of the embers taken, in the area's list (the goal last), sorted. */
  taken: z.array(count),
  goal: z.boolean(),
  playTicks: count,
})

export type Base3dSave = z.infer<typeof base3dSaveSchema>

/** A new game: nothing taken. */
export const newGame = (): Base3dSave => ({ taken: [], goal: false, playTicks: 0 })

export const base3dSave: SaveDef<Base3dSave> = {
  key: 'base-3d-free',
  version: 1,
  schema: base3dSaveSchema,
  empty: newGame,
  migrations: {},
  autosave: { on: ['screen-exit', 'background', 'interval'], intervalSeconds: 60 },
}
