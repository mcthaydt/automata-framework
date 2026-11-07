// The systems' state, all of it in resources so snapshots and replays carry it (M6 spec §4.6): the loaded def, each
// agent's record, the rule clocks and reserved nodes, the noises on the world, pursuit, and the env the game writes.
import { type Value, valueSchema } from '@automata/puzzle/sim'
import { defineResource, type ResourceDef } from '@automata/sim'
import { z } from 'zod'
import { type SystemsDef, systemsDefShape } from './systems.schema'

interface Point {
  x: number
  z: number
}
const point = z.strictObject({ x: z.number(), z: z.number() })

export interface SystemsSceneState {
  /** The loaded scene's systems; null until the game loads one. */
  def: SystemsDef | null
}
const sceneSchema: z.ZodType<SystemsSceneState> = z.strictObject({ def: systemsDefShape.nullable() })
export const SystemsScene: ResourceDef<typeof sceneSchema> = defineResource(
  'systems.scene',
  sceneSchema,
  () => ({
    def: null,
  }),
)

/** An appearance under way (door-follow or an ambush): while the agent keeps `mode`, after `in` s it comes to `at`. */
export interface Pending {
  mode: string
  at: Point
  in: number
  hold: number
  clear: number
  then: string
  /** A follow's far zone: an agent already in it on foot needs no appearance. */
  zone?: string | undefined
  shown?: boolean | undefined
}
/** An agent's live state, apart from its plan position (its entity's `InSector`). */
export interface AgentRecord {
  /** Its entity. */
  sid: number
  mode: string
  facing: number
  moving: boolean
  /** Seconds spent waiting in this mode: standing at the end of its path, or refusing a step. Effects reset it. */
  timer: number
  /** Seconds to the next re-route while chasing a moving goal (hooks keep it). */
  replan: number
  /** The routine stop it is heading for or dwelling at. */
  patrol: number
  path: Point[]
  goal: Point | null
  pending?: Pending | undefined
  /** Fields a scene's hooks and `self.<name>` facts keep on the agent (the source's extra agent fields). */
  own: Record<string, Value>
}
export interface SystemsStateValue {
  agents: Record<string, AgentRecord>
  /** Seconds since each rule last fired. */
  clocks: Record<string, number>
  /** Node id → the one agent that may walk to it (`reserveNodes`). */
  reserved: Record<string, string>
}
const pendingSchema = z.strictObject({
  mode: z.string(),
  at: point,
  in: z.number(),
  hold: z.number(),
  clear: z.number(),
  then: z.string(),
  zone: z.string().optional(),
  shown: z.boolean().optional(),
})
const stateSchema: z.ZodType<SystemsStateValue> = z.strictObject({
  agents: z.record(
    z.string(),
    z.strictObject({
      sid: z.number().int(),
      mode: z.string(),
      facing: z.number(),
      moving: z.boolean(),
      timer: z.number(),
      replan: z.number(),
      patrol: z.number().int(),
      path: z.array(point),
      goal: point.nullable(),
      pending: pendingSchema.optional(),
      own: z.record(z.string(), valueSchema),
    }),
  ),
  clocks: z.record(z.string(), z.number()),
  reserved: z.record(z.string(), z.string()),
})
export const SystemsState: ResourceDef<typeof stateSchema> = defineResource(
  'systems.state',
  stateSchema,
  () => ({
    agents: {},
    clocks: {},
    reserved: {},
  }),
)

export interface Noise {
  x: number
  z: number
  loudness: number
  kind: string
  /** Seconds since it was made; it is gone at `NOISE_LIFE`. */
  age: number
}
const noisesSchema: z.ZodType<{ noises: Noise[] }> = z.strictObject({
  noises: z.array(
    z.strictObject({ x: z.number(), z: z.number(), loudness: z.number(), kind: z.string(), age: z.number() }),
  ),
})
export const SystemsNoises: ResourceDef<typeof noisesSchema> = defineResource(
  'systems.noises',
  noisesSchema,
  () => ({
    noises: [],
  }),
)

/** A portal the player crossed into another zone: its id (`from>to`), its middle, and the spot just inside `to`. */
export interface Crossing {
  portal: string
  from: string
  to: string
  zone: string
  x: number
  z: number
  into: Point
}
/** Where an agent stood as the player hid; `los`: it had a line of sight to her past the walls. */
export interface Watcher {
  x: number
  z: number
  mode: string
  los: boolean
}
export interface PursuitValue {
  /** The sector the player stood in at the last step; '' off the map. */
  sector: string
  /** The player crossed into another zone this step. */
  crossed: Crossing | null
  /** The last portal she crossed into another zone. */
  last: Crossing | null
  /** The hiding place the player is in; '' when she is not hiding. */
  hidden: string
  hiddenFor: number
  /** Every agent as she hid, by id. */
  watchers: Record<string, Watcher>
  /** Ambushes that have fired, by id. */
  ambushes: Record<string, boolean>
}
const crossing = z.strictObject({
  portal: z.string(),
  from: z.string(),
  to: z.string(),
  zone: z.string(),
  x: z.number(),
  z: z.number(),
  into: point,
})
const pursuitSchema: z.ZodType<PursuitValue> = z.strictObject({
  sector: z.string(),
  crossed: crossing.nullable(),
  last: crossing.nullable(),
  hidden: z.string(),
  hiddenFor: z.number(),
  watchers: z.record(
    z.string(),
    z.strictObject({ x: z.number(), z: z.number(), mode: z.string(), los: z.boolean() }),
  ),
  ambushes: z.record(z.string(), z.boolean()),
})
export const emptyPursuit = (): PursuitValue => ({
  sector: '',
  crossed: null,
  last: null,
  hidden: '',
  hiddenFor: 0,
  watchers: {},
  ambushes: {},
})
export const SystemsPursuit: ResourceDef<typeof pursuitSchema> = defineResource(
  'systems.pursuit',
  pursuitSchema,
  emptyPursuit,
)

/** What the game tells the systems each step (SY-D3): who the player is, whether she moves, its lights and warm things. */
export interface SystemsEnvValue {
  /** The player's entity (it has sectors' `InSector`); 0 for none. */
  player: number
  moving: boolean
  /** Gameplay light as discs: a point is lit by the first disc, in order, that covers it. */
  lights: { x: number; z: number; radius: number }[]
  /** Warm things now, by kind (lighter, torch, drum…). */
  warmth: { x: number; z: number; kind: string }[]
}
const envSchema: z.ZodType<SystemsEnvValue> = z.strictObject({
  player: z.number().int().min(0),
  moving: z.boolean(),
  lights: z.array(z.strictObject({ x: z.number(), z: z.number(), radius: z.number() })),
  warmth: z.array(z.strictObject({ x: z.number(), z: z.number(), kind: z.string() })),
})
export const SystemsEnv: ResourceDef<typeof envSchema> = defineResource('systems.env', envSchema, () => ({
  player: 0,
  moving: false,
  lights: [],
  warmth: [],
}))
