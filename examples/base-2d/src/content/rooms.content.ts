import { defineContentSchema } from '@mcthaydt/automata-content'
import { z } from 'zod'
import { readRoomGrid } from './room-grid.ts'

// The `rooms` kind: one TOML file per room in `content/rooms/`, its ID the file name. The compiler checks it
// and stores the checked grid (size, start and goal found), which is what the sim reads.

/** The checked grid, as the compiler stores it. Piping into it gives content.d.ts a real type for `Rooms`. */
const tile = z.object({ tx: z.int(), ty: z.int() })
const roomGrid = z.object({
  tileSize: z.int(),
  width: z.int(),
  height: z.int(),
  rows: z.array(z.string()),
  start: tile,
  goal: tile,
})

const roomSchema = z
  .object({
    tile_size: z.int().positive(),
    rows: z.array(z.string().min(1)).min(1),
  })
  .strict()
  .transform((source, ctx) => {
    try {
      return readRoomGrid(source.tile_size, source.rows)
    } catch (error) {
      ctx.addIssue({ code: 'custom', message: error instanceof Error ? error.message : String(error) })
      return z.NEVER
    }
  })
  .pipe(roomGrid)

export const rooms = defineContentSchema('rooms', roomSchema, { folder: 'rooms' })
