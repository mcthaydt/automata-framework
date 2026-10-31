// base-3d's save (DESIGN.md §12.1): one slot under one Ruken key. The resume point is an area's entrance (GAME3D-D9),
// so room-local state is never saved. Every change to the shape after the first deploy bumps `version` and adds
// `migrations[n]` (n → n + 1) with a real version-n fixture in save-fixtures/ and a test that it migrates and parses.
// Sim-free: zod and a type-only import, so `pnpm boundaries` passes it with the other state files.
import type { SaveDef } from '@mcthaydt/automata-runtime'
import { z } from 'zod'

const count = z.number().int().nonnegative()
const ids = z.array(z.string())

/** The saved record; unknown fields pass through (M5 §4.2), so a later build's additions survive this build's write. */
export const base3dSaveSchema = z.looseObject({
  /** Heart-piece entity ids collected. */
  hearts: z.strictObject({ max: count, pieces: ids }),
  embers: count,
  items: z.strictObject({ sling: z.boolean(), bombs: z.boolean(), hookchain: z.boolean() }),
  ammo: z.strictObject({ pellets: count, bombs: count }),
  equipped: z.enum(['sling', 'bombs', 'hookchain']).nullable(),
  /** Persistent entity ids: opened doors and chests, cracked walls, latched switches, lit lanterns. */
  flags: ids,
  kiln: z.strictObject({
    smallKeys: count,
    bossKey: z.boolean(),
    map: z.boolean(),
    compass: z.boolean(),
    visited: ids,
    bossDefeated: z.boolean(),
  }),
  /** The area whose entrance Continue returns to. */
  resume: z.enum(['hub', 'kiln']),
  playTicks: count,
})

export type Base3dSave = z.infer<typeof base3dSaveSchema>

/** A new game: four hearts (DESIGN.md §7.8), nothing found, in the hub. */
export const newGame = (): Base3dSave => ({
  hearts: { max: 4, pieces: [] },
  embers: 0,
  items: { sling: false, bombs: false, hookchain: false },
  ammo: { pellets: 0, bombs: 0 },
  equipped: null,
  flags: [],
  kiln: { smallKeys: 0, bossKey: false, map: false, compass: false, visited: [], bossDefeated: false },
  resume: 'hub',
  playTicks: 0,
})

export const base3dSave: SaveDef<Base3dSave> = {
  key: 'base-3d',
  version: 1,
  schema: base3dSaveSchema,
  empty: newGame,
  migrations: {},
  autosave: { on: ['screen-exit', 'background', 'interval'], intervalSeconds: 60 },
}
