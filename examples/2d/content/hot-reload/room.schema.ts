import { parseRoom, type RoomSource } from '@af-games/emberwick/room'
import { defineContentSchema } from '@automata/content'
import { z } from 'zod'

// The one content kind this demo registers: the room, in content/room.toml. Zod checks the shape; parseRoom (the
// base's own rule) checks the tiles, so a bad save is reported by the compiler with the base's message and never
// reaches the game.
/**
 * Where in room.toml an issue is, so the compiler can report its line: parseRoom names the row it found a
 * problem on ("…row 5…"); a rule about the whole room (one P, one G) points at `rows` itself.
 */
function issuePath(message: string): (string | number)[] {
  const row = /\brow (\d+)\b/.exec(message)
  return row === null ? ['rows'] : ['rows', Number(row[1])]
}

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
        const message = error instanceof Error ? error.message : String(error)
        context.addIssue({ code: 'custom', message, path: issuePath(message) })
      }
    }),
  { file: 'room.toml' },
)
