// What the player does in a conversation (M6 spec §4.7): start a graph (a game may also start one from puzzle's
// `{ dialogue }` effect), advance a line, choose an answer by its index in the node's own list.
import { type CommandDef, defineCommand } from '@mcthaydt/automata-sim'
import { z } from 'zod'

export interface StartPayload {
  readonly graph: string
}
export const StartCommand: CommandDef<z.ZodType<StartPayload>> = defineCommand(
  'narrative.start',
  z.strictObject({ graph: z.string() }),
)
export const AdvanceCommand: CommandDef<z.ZodType<Record<string, never>>> = defineCommand(
  'narrative.advance',
  z.strictObject({}),
)
export interface ChoosePayload {
  readonly index: number
}
export const ChooseCommand: CommandDef<z.ZodType<ChoosePayload>> = defineCommand(
  'narrative.choose',
  z.strictObject({ index: z.number().int().min(0) }),
)
