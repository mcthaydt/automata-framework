// The puzzle's sim state (M6 spec §4.5): the scene's def as content gives it, and the play state: facts (a record,
// canonical in snapshots), carried items (kept sorted), the actions seen, and whether the goal has been reported.
import { defineResource, type ResourceDef } from '@automata/sim'
import { z } from 'zod'
import { type PuzzleDef, puzzleDefShape } from './puzzle.schema'
import { type Value, valueSchema } from './value.schema'

export interface PuzzleScene {
  /** Null until the game loads a scene's puzzle. */
  def: PuzzleDef | null
}
const sceneSchema: z.ZodType<PuzzleScene> = z.strictObject({
  def: puzzleDefShape.nullable(),
}) as z.ZodType<PuzzleScene>

export const PuzzleSceneResource: ResourceDef<z.ZodType<PuzzleScene>> = defineResource(
  'puzzle.scene',
  sceneSchema,
  () => ({
    def: null,
  }),
)

export interface PuzzleStateValue {
  facts: Record<string, Value>
  items: string[]
  seen: string[]
  goal: boolean
}
const stateSchema: z.ZodType<PuzzleStateValue> = z.strictObject({
  facts: z.record(z.string(), valueSchema),
  items: z.array(z.string()),
  seen: z.array(z.string()),
  goal: z.boolean(),
})

/** Facts, carried items (sorted), the ids of actions applied so far, and whether `puzzle.goal` was emitted. */
export const PuzzleState: ResourceDef<z.ZodType<PuzzleStateValue>> = defineResource(
  'puzzle.state',
  stateSchema,
  () => ({
    facts: {},
    items: [],
    seen: [],
    goal: false,
  }),
)
