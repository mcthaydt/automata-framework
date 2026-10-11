import { parseRoom, type RoomSource } from '@af-examples/base-2d/room'
import { defineContentSchema } from '@mcthaydt/automata-content'
import { z } from 'zod'

// The one content kind this demo registers: the room, in content/room.toml. Zod checks the shape; parseRoom (the
// base's own rule) checks the tiles, so a bad save is reported by the compiler with the base's message and never
// reaches the game.
export const roomSchema = defineContentSchema(
  'room',
  z
    .strictObject({
      id: z.string().regex(/^[a-z0-9-]+$/),
      tileSize: z.int().min(4).max(32),
      rows: z.array(z.string()).min(3),
    })
    .superRefine((room: RoomSource, context) => {
      try {
        parseRoom(room)
      } catch (error) {
        context.addIssue({ code: 'custom', message: error instanceof Error ? error.message : String(error) })
      }
    }),
  { file: 'room.toml' },
)
