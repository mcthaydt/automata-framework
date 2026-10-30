import { type CommandDef, defineCommand } from '@mcthaydt/automata-sim'
import { z } from 'zod'

// The race's commands. A seat's commands carry `source` = seat (M7's input queue); `race.start` comes from the room.

export interface RaceStartPayload {
  readonly courseSeed: number
  /** The seats that race, each once; at most four (FloorFifty's room capacity). */
  readonly seats: readonly number[]
}

const startSchema: z.ZodType<RaceStartPayload> = z
  .object({
    courseSeed: z.number().int().min(0).max(0xffffffff),
    seats: z
      .array(z.number().int().min(0).max(15))
      .min(1)
      .max(4)
      .refine((seats) => new Set(seats).size === seats.length, { message: 'each seat races once' }),
  })
  .strict()
/** Builds the course from `courseSeed`, spawns a racer per seat and starts the race. Taken once. */
export const RaceStart: CommandDef<z.ZodType<RaceStartPayload>> = defineCommand('race.start', startSchema)

export interface RaceInputPayload {
  readonly left: boolean
  readonly right: boolean
  readonly fastFall: boolean
}

const inputSchema: z.ZodType<RaceInputPayload> = z
  .object({ left: z.boolean(), right: z.boolean(), fastFall: z.boolean() })
  .strict()
/** The input the sending seat now holds, in force until its next `race.input`. */
export const RaceInput: CommandDef<z.ZodType<RaceInputPayload>> = defineCommand('race.input', inputSchema)

const resetSchema: z.ZodType<Record<string, never>> = z.object({}).strict()
/** The sending seat asks to restart its ascent: one command, one respawn (an edge, not a held state). */
export const RaceReset: CommandDef<z.ZodType<Record<string, never>>> = defineCommand(
  'race.reset',
  resetSchema,
)
