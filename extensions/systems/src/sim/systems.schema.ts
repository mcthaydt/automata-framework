// `systems` content (M6 spec §4.6): world rules and agents as data, the adventure source's `SystemsDef` unchanged in
// shape, with its WP-19 additions (`crossed`, `sawHide`, `followThrough`, `ambush`). Probes ask about the world,
// effects change it, senses say what an agent can perceive. The definition checks are `systems-checks.ts`.

import { type Value, valueSchema } from '@automata/puzzle/sim'
import type { Point } from '@automata/sectors/sim'
import { z } from 'zod'

export type Probe =
  | { readonly inLight: true; readonly radius?: number | undefined }
  /** `reach` absent: heard at any distance (the source's `Infinity`; content has no Infinity). */
  | { readonly heard: string; readonly reach?: number | undefined }
  | { readonly sees: true }
  | { readonly warmthWithin: number }
  | { readonly touching: true; readonly radius?: number | undefined }
  | { readonly fact: string; readonly is: Value }
  | { readonly mode: string; readonly agent?: string | undefined }
  | { readonly at: string }
  | { readonly timer: number }
  | { readonly not: Probe }
  | { readonly crossed: true }
  | { readonly sawHide: { readonly radius: number; readonly los?: boolean | undefined } }

export type SysEffect =
  | { readonly setMode: string; readonly agent?: string | undefined }
  | { readonly goTo: string | Point }
  | { readonly flee: string }
  | { readonly noise: { readonly at: Point | string; readonly loudness: number; readonly kind: string } }
  | { readonly set: string; readonly to: Value }
  | {
      readonly emit: { readonly cutscene: string } | { readonly caught: string } | { readonly line: string }
    }
  | { readonly call: string }
  | {
      readonly followThrough: {
        readonly portal: string
        readonly delay: number
        readonly then: string
        readonly clear?: number | undefined
      }
    }
  | {
      readonly ambush: {
        readonly id: string
        readonly agent: string
        readonly mode: string
        readonly at: string | Point
        readonly sting: number
        readonly grace: number
        readonly then: string
      }
    }

export type Sense =
  | { readonly light: { readonly radius?: number | undefined } }
  | { readonly sound: { readonly reach?: number | undefined } }
  | { readonly sight: { readonly range: number; readonly wallsOnly?: boolean | undefined } }
  | { readonly warmth: { readonly sources: Readonly<Record<string, number>> } }
  | { readonly touch: { readonly radius: number } }

export interface Rule {
  readonly id: string
  readonly text: string
  readonly every?: number | undefined
  readonly when: readonly Probe[]
  readonly then: readonly SysEffect[]
}

export interface Transition {
  readonly from: string
  readonly to: string
  readonly when: readonly Probe[]
  readonly priority: number
  readonly do?: readonly SysEffect[] | undefined
}

export interface RoutineStop {
  readonly node: string
  readonly dwell: number
  readonly do?: readonly SysEffect[] | undefined
}

export interface AgentDef {
  readonly id: string
  /** Metres per second per mode; a mode with no speed is still. */
  readonly speed: Readonly<Record<string, number>>
  readonly modes: readonly string[]
  readonly initial: string
  readonly senses: readonly Sense[]
  /** The highest priority whose probes all hold wins. */
  readonly transitions: readonly Transition[]
  /** A patrol with actions. */
  readonly routine?: readonly RoutineStop[] | undefined
  /** Named sim functions the game gives `createSystems`, for what data cannot say. */
  readonly hooks?: readonly string[] | undefined
}

export interface Scenario {
  readonly id: string
  readonly claims?: string | undefined
  readonly setup: {
    readonly place?: Readonly<Record<string, Point>> | undefined
    readonly facts?: Readonly<Record<string, Value>> | undefined
    readonly items?: readonly string[] | undefined
    readonly actions?: readonly string[] | undefined
  }
  readonly policy: string
  readonly expect: {
    readonly condition: readonly Probe[]
    readonly within: number
    readonly probability: number
  }
  readonly seeds: number
}

export interface Fairness {
  readonly cautiousWin: number
  readonly firstThreatAfter: number
  readonly telegraph: number
  readonly maxDeathsPerRun: number
  readonly safeWindowMargin: number
  readonly ambushGrace?: number | undefined
  readonly followClear?: number | undefined
  readonly hideRelease?: number | undefined
}

export interface Tunable {
  readonly value: number
  readonly min: number
  readonly max: number
  readonly unit: string
  readonly note: string
}

export interface MatrixCell {
  readonly row: string
  readonly col: string
  readonly verb: string
  readonly rule?: string | undefined
  readonly presentation?: string | undefined
  readonly cut?: string | undefined
}

export interface SystemsDef {
  /** The scene; its nav graph and sector map are the ones the game loads with it. */
  readonly scene: string
  readonly objects: readonly { readonly id: string; readonly name: string; readonly signal: string }[]
  readonly matrix: readonly MatrixCell[]
  readonly tunables: Readonly<Record<string, Tunable>>
  readonly rules: readonly Rule[]
  readonly agents: readonly AgentDef[]
  readonly scenarios: readonly Scenario[]
  readonly fairness: Fairness
}

const point = z.strictObject({ x: z.number(), z: z.number() })
const place = z.union([z.string(), point])

export const probeSchema: z.ZodType<Probe> = z.lazy(() =>
  z.union([
    z.strictObject({ inLight: z.literal(true), radius: z.number().optional() }),
    z.strictObject({ heard: z.string(), reach: z.number().optional() }),
    z.strictObject({ sees: z.literal(true) }),
    z.strictObject({ warmthWithin: z.number() }),
    z.strictObject({ touching: z.literal(true), radius: z.number().optional() }),
    z.strictObject({ fact: z.string(), is: valueSchema }),
    z.strictObject({ mode: z.string(), agent: z.string().optional() }),
    z.strictObject({ at: z.string() }),
    z.strictObject({ timer: z.number() }),
    z.strictObject({ not: probeSchema }),
    z.strictObject({ crossed: z.literal(true) }),
    z.strictObject({ sawHide: z.strictObject({ radius: z.number(), los: z.boolean().optional() }) }),
  ]),
)

export const effectSchema: z.ZodType<SysEffect> = z.union([
  z.strictObject({ setMode: z.string(), agent: z.string().optional() }),
  z.strictObject({ goTo: place }),
  z.strictObject({ flee: z.string() }),
  z.strictObject({ noise: z.strictObject({ at: place, loudness: z.number(), kind: z.string() }) }),
  z.strictObject({ set: z.string(), to: valueSchema }),
  z.strictObject({
    emit: z.union([
      z.strictObject({ cutscene: z.string() }),
      z.strictObject({ caught: z.string() }),
      z.strictObject({ line: z.string() }),
    ]),
  }),
  z.strictObject({ call: z.string() }),
  z.strictObject({
    followThrough: z.strictObject({
      portal: z.string(),
      delay: z.number(),
      then: z.string(),
      clear: z.number().optional(),
    }),
  }),
  z.strictObject({
    ambush: z.strictObject({
      id: z.string(),
      agent: z.string(),
      mode: z.string(),
      at: place,
      sting: z.number(),
      grace: z.number(),
      then: z.string(),
    }),
  }),
])

const senseSchema: z.ZodType<Sense> = z.union([
  z.strictObject({ light: z.strictObject({ radius: z.number().optional() }) }),
  z.strictObject({ sound: z.strictObject({ reach: z.number().optional() }) }),
  z.strictObject({ sight: z.strictObject({ range: z.number(), wallsOnly: z.boolean().optional() }) }),
  z.strictObject({ warmth: z.strictObject({ sources: z.record(z.string(), z.number()) }) }),
  z.strictObject({ touch: z.strictObject({ radius: z.number() }) }),
])

const effects = z.array(effectSchema)
const agentSchema: z.ZodType<AgentDef> = z.strictObject({
  id: z.string(),
  speed: z.record(z.string(), z.number()),
  modes: z.array(z.string()),
  initial: z.string(),
  senses: z.array(senseSchema),
  transitions: z.array(
    z.strictObject({
      from: z.string(),
      to: z.string(),
      when: z.array(probeSchema),
      priority: z.number(),
      do: effects.optional(),
    }),
  ),
  routine: z
    .array(z.strictObject({ node: z.string(), dwell: z.number(), do: effects.optional() }))
    .optional(),
  hooks: z.array(z.string()).optional(),
})

export const systemsDefShape: z.ZodType<SystemsDef> = z.strictObject({
  scene: z.string(),
  objects: z.array(z.strictObject({ id: z.string(), name: z.string(), signal: z.string() })),
  matrix: z.array(
    z.strictObject({
      row: z.string(),
      col: z.string(),
      verb: z.string(),
      rule: z.string().optional(),
      presentation: z.string().optional(),
      cut: z.string().optional(),
    }),
  ),
  tunables: z.record(
    z.string(),
    z.strictObject({
      value: z.number(),
      min: z.number(),
      max: z.number(),
      unit: z.string(),
      note: z.string(),
    }),
  ),
  rules: z.array(
    z.strictObject({
      id: z.string(),
      text: z.string(),
      every: z.number().optional(),
      when: z.array(probeSchema),
      then: effects,
    }),
  ),
  agents: z.array(agentSchema),
  scenarios: z.array(
    z.strictObject({
      id: z.string(),
      claims: z.string().optional(),
      setup: z.strictObject({
        place: z.record(z.string(), point).optional(),
        facts: z.record(z.string(), valueSchema).optional(),
        items: z.array(z.string()).optional(),
        actions: z.array(z.string()).optional(),
      }),
      policy: z.string(),
      expect: z.strictObject({
        condition: z.array(probeSchema),
        within: z.number(),
        probability: z.number(),
      }),
      seeds: z.number(),
    }),
  ),
  fairness: z.strictObject({
    cautiousWin: z.number(),
    firstThreatAfter: z.number(),
    telegraph: z.number(),
    maxDeathsPerRun: z.number(),
    safeWindowMargin: z.number(),
    ambushGrace: z.number().optional(),
    followClear: z.number().optional(),
    hideRelease: z.number().optional(),
  }),
})
