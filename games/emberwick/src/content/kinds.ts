import { defineContentSchema } from '@mcthaydt/automata-content'
import { z } from 'zod'

// The content kinds Emberwick registers for its room, which the 2D editor authors (`content/rooms/room-1.af2d.json`) and
// exports as `content/levels/<id>.toml`, `project.toml` and `world.toml` (2D editor spec §6.2). The sim receives the levels
// and the tuning; the project's definitions and the world's placements are for the editor and the tools, so they stay
// out of the sim's content and its hash.
//
// Loose objects: the compiler checks what this game reads (the size, the collision rows, the entities) and keeps the rest
// as the editor wrote it.

const levelLayer = z.looseObject({
  def: z.string(),
  kind: z.string(),
  rows: z.array(z.string()).optional(),
  items: z.array(z.looseObject({ def: z.string(), x: z.number().int(), y: z.number().int() })).optional(),
})

export const LEVEL = z.looseObject({
  id: z.string(),
  size: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }),
  layers: z.array(levelLayer),
})

export const EMBERWICK_KINDS = [
  defineContentSchema('levels', LEVEL, { folder: 'levels' }),
  defineContentSchema('project', z.looseObject({}), { file: 'project.toml' }, { sim: false }),
  defineContentSchema('world', z.looseObject({}), { file: 'world.toml' }, { sim: false }),
]
