// `PuzzleDef`: the adventure source's puzzle contract, unchanged in shape (facts, items, entry, actions,
// systemic, lethal, goal, fallback), with `hotspots` added (where a hotspot is, for a noise at it; P6-D4).
import { z } from 'zod'
import { type Cond, condSchema, type Value, valueSchema } from './value.schema'

/** A spot on the floor. */
export interface Point {
  readonly x: number
  readonly z: number
}
const pointSchema: z.ZodType<Point> = z.strictObject({ x: z.number(), z: z.number() })

/**
 * What an action does when it is taken: set or add to a fact, give or take an item, make a noise,
 * start a cutscene or a dialogue, mark a checkpoint, open the keypad, leave through an exit, or
 * call a function the game supplied.
 */
export type Effect =
  | { readonly set: string; readonly to: Value }
  | { readonly add: string; readonly by: number }
  | { readonly give: string }
  | { readonly take: string }
  | { readonly noise: { readonly at: Point | string; readonly loudness: number; readonly kind: string } }
  | { readonly cutscene: string }
  | { readonly checkpoint: true }
  | { readonly keypad: true }
  | { readonly exit: { readonly to: string; readonly cutscene: string } }
  | { readonly dialogue: string }
  | { readonly call: string }

/** The Zod schema of an effect. */
export const effectSchema: z.ZodType<Effect> = z.union([
  z.strictObject({ set: z.string(), to: valueSchema }),
  z.strictObject({ add: z.string(), by: z.number() }),
  z.strictObject({ give: z.string() }),
  z.strictObject({ take: z.string() }),
  z.strictObject({
    noise: z.strictObject({ at: z.union([pointSchema, z.string()]), loudness: z.number(), kind: z.string() }),
  }),
  z.strictObject({ cutscene: z.string() }),
  z.strictObject({ checkpoint: z.literal(true) }),
  z.strictObject({ keypad: z.literal(true) }),
  z.strictObject({ exit: z.strictObject({ to: z.string(), cutscene: z.string() }) }),
  z.strictObject({ dialogue: z.string() }),
  z.strictObject({ call: z.string() }),
])

/** Where a verb is aimed: a hotspot id, or one of the three verbs that are not at a hotspot. */
export type VerbAt = string

/**
 * One thing the player can do at a hotspot: where it is aimed (`at`), the item or pair of items it
 * uses, the conditions that must hold, its effects, the line said and how many seconds it takes.
 */
export interface Action {
  readonly id: string
  readonly at: VerbAt
  readonly use?: string | readonly [string, string] | undefined
  readonly when?: readonly Cond[] | undefined
  readonly then: readonly Effect[]
  readonly say: string
  readonly seconds?: number | undefined
}

const actionSchema: z.ZodType<Action> = z.strictObject({
  id: z.string(),
  at: z.string(),
  use: z.union([z.string(), z.tuple([z.string(), z.string()])]).optional(),
  when: z.array(condSchema).optional(),
  then: z.array(effectSchema),
  say: z.string(),
  seconds: z.number().optional(),
})

/**
 * A way of solving the puzzle that no single action shows, with a note, the conditions it enables,
 * the actions that lead to it and any risk (`lethal` or `chase`).
 */
export interface Systemic {
  readonly id: string
  readonly note: string
  readonly enables: readonly Cond[]
  readonly via: readonly string[]
  readonly risk?: 'lethal' | 'chase' | undefined
}

/** A way to fail, with its rule and the hints that warn the player. */
export interface Lethal {
  readonly id: string
  readonly rule: string
  readonly hintedBy: readonly string[]
}

/** A way into the scene: its name, the items the player arrives with and any facts it sets. */
export interface Entry {
  readonly name: string
  readonly items: readonly string[]
  readonly facts?: Readonly<Record<string, Value>> | undefined
}

/**
 * One scene's puzzle: its facts and items, where its hotspots are, the ways in, the actions, the
 * systemic solutions and lethal rules, the goal and the fallback lines for verbs that match
 * nothing.
 */
export interface PuzzleDef {
  readonly scene: string
  readonly facts: Readonly<Record<string, Value>>
  readonly items: readonly string[]
  readonly hotspots: Readonly<Record<string, Point>>
  readonly entry: readonly Entry[]
  readonly actions: readonly Action[]
  readonly systemic: readonly Systemic[]
  readonly lethal: readonly Lethal[]
  readonly goal: readonly Cond[]
  readonly fallback: Readonly<Record<string, string>>
}

/** The Zod schema of a puzzle's shape, without the cross-checks that `puzzleSchema` adds. */
export const puzzleDefShape: z.ZodType<PuzzleDef> = z.strictObject({
  scene: z.string(),
  facts: z.record(z.string(), valueSchema),
  items: z.array(z.string()),
  hotspots: z.record(z.string(), pointSchema),
  entry: z.array(
    z.strictObject({
      name: z.string(),
      items: z.array(z.string()),
      facts: z.record(z.string(), valueSchema).optional(),
    }),
  ),
  actions: z.array(actionSchema),
  systemic: z.array(
    z.strictObject({
      id: z.string(),
      note: z.string(),
      enables: z.array(condSchema),
      via: z.array(z.string()),
      risk: z.enum(['lethal', 'chase']).optional(),
    }),
  ),
  lethal: z.array(z.strictObject({ id: z.string(), rule: z.string(), hintedBy: z.array(z.string()) })),
  goal: z.array(condSchema),
  fallback: z.record(z.string(), z.string()),
}) as z.ZodType<PuzzleDef>
