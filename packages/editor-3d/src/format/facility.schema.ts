// Extracted from The Last Light scripts/pipeline/facility-lib.ts (92e6704, the `Manifest` types):
// docs/art/blockout-facility/facility.json, the facility's wings, joins, street, phases and locks. A pure
// validator like the blockout schema: no defaults, unknown members kept.
import { z } from 'zod'

export type FacilityVector = readonly [number, number, number]

export interface FacilityDifference {
  readonly path: string
  readonly why: string
}

export interface FacilityWing {
  readonly id: string
  /** Where the wing's own frame sits in the world: [x, y, z] metres. */
  readonly offset: FacilityVector
  readonly phases: readonly string[]
  /** The phase whose blockout the others are compared with. */
  readonly reference: string
  /** The pursuer that keeps this wing. */
  readonly npc: string
  /** Geometry that differs from the reference on purpose, by phase: a path covers every difference at or under it. */
  readonly differences?: Readonly<Record<string, readonly FacilityDifference[]>> | undefined
}

export type JoinSide =
  | { readonly phase: string; readonly room: string; readonly door: string }
  | { readonly phase: string; readonly room: string; readonly opening: string }
  | { readonly phase: string; readonly room: string; readonly wall: number }
  | { readonly street: 'start' | 'end' }

export interface FacilityJoin {
  readonly id: string
  readonly why?: string | undefined
  readonly a: JoinSide
  readonly b: JoinSide
}

type FactValue = boolean | number | string

/** A door's state through a phase: always open, always shut, or open while a world field holds a value. */
export type DoorRule =
  | 'open'
  | 'shut'
  | { readonly fact: string; readonly is?: FactValue | undefined; readonly else?: FactValue | undefined }

export interface FacilityPhase {
  readonly id: string
  readonly name: string
  readonly scene: string
  readonly wing: string
  /** What crosses into this phase: nothing (a new night) or the world. */
  readonly carry: 'none' | 'world'
  /** Every room of the phase's blockout, openings' connectors aside. */
  readonly rooms: readonly string[]
  /** Rooms drawn but never walked. */
  readonly seen?: readonly string[] | undefined
  /** Each door lock that holds in this phase (facility lock id), and its state. */
  readonly doors: Readonly<Record<string, DoorRule>>
  /** The transition out, as the rules give it once the world field holds the value. */
  readonly exit: {
    readonly fact: string
    readonly is: FactValue
    readonly to: string
    readonly cutscene: string
  } | null
  readonly save: { readonly at: string; readonly ask: string } | null
  readonly why?: string | undefined
}

/** A lock's kind, the map's badge glyph: what its openers take. */
export type LockKind = 'key' | 'code' | 'power' | 'latch' | 'barricade'

export interface FacilityLock {
  readonly id: string
  readonly story?: string | undefined
  readonly phases: readonly string[]
  /** The hotspot, box or wall door it is on. */
  readonly at: string | readonly string[]
  /** Its key in the rules' nav or the presentation's doors, when the engine opens it. */
  readonly door?: string | undefined
  /** Puzzle action ids: what opens it, and what the player gets when it does not. */
  readonly opens: readonly string[]
  readonly fallback: readonly string[]
  readonly hints: readonly string[]
  readonly lethal?: readonly string[] | undefined
  readonly kind?: LockKind | undefined
  readonly why?: string | undefined
}

export interface FacilityStreet {
  readonly why?: string | undefined
  readonly path: readonly (readonly [number, number])[]
  readonly clear: number
}

export interface Facility {
  readonly about?: string | undefined
  readonly wings: readonly FacilityWing[]
  readonly joins: readonly FacilityJoin[]
  readonly street: FacilityStreet
  readonly phases: readonly FacilityPhase[]
  readonly locks: readonly FacilityLock[]
}

const stringList = z.array(z.string())
const factValue = z.union([z.boolean(), z.number(), z.string()])

const wingSchema: z.ZodType<FacilityWing> = z.looseObject({
  id: z.string(),
  offset: z.tuple([z.number(), z.number(), z.number()]),
  phases: stringList,
  reference: z.string(),
  npc: z.string(),
  differences: z.record(z.string(), z.array(z.looseObject({ path: z.string(), why: z.string() }))).optional(),
})

const joinSideSchema: z.ZodType<JoinSide> = z.union([
  z.looseObject({ phase: z.string(), room: z.string(), door: z.string() }),
  z.looseObject({ phase: z.string(), room: z.string(), opening: z.string() }),
  z.looseObject({ phase: z.string(), room: z.string(), wall: z.number() }),
  z.looseObject({ street: z.enum(['start', 'end']) }),
])

const joinSchema: z.ZodType<FacilityJoin> = z.looseObject({
  id: z.string(),
  why: z.string().optional(),
  a: joinSideSchema,
  b: joinSideSchema,
})

const doorRuleSchema: z.ZodType<DoorRule> = z.union([
  z.enum(['open', 'shut']),
  z.looseObject({ fact: z.string(), is: factValue.optional(), else: factValue.optional() }),
])

const phaseSchema: z.ZodType<FacilityPhase> = z.looseObject({
  id: z.string(),
  name: z.string(),
  scene: z.string(),
  wing: z.string(),
  carry: z.enum(['none', 'world']),
  rooms: stringList,
  seen: stringList.optional(),
  doors: z.record(z.string(), doorRuleSchema),
  exit: z.looseObject({ fact: z.string(), is: factValue, to: z.string(), cutscene: z.string() }).nullable(),
  save: z.looseObject({ at: z.string(), ask: z.string() }).nullable(),
  why: z.string().optional(),
})

const lockSchema: z.ZodType<FacilityLock> = z.looseObject({
  id: z.string(),
  story: z.string().optional(),
  phases: stringList,
  at: z.union([z.string(), stringList]),
  door: z.string().optional(),
  opens: stringList,
  fallback: stringList,
  hints: stringList,
  lethal: stringList.optional(),
  kind: z.enum(['key', 'code', 'power', 'latch', 'barricade']).optional(),
  why: z.string().optional(),
})

export const facilitySchema: z.ZodType<Facility> = z.looseObject({
  about: z.string().optional(),
  wings: z.array(wingSchema),
  joins: z.array(joinSchema),
  street: z.looseObject({
    why: z.string().optional(),
    path: z.array(z.tuple([z.number(), z.number()])),
    clear: z.number(),
  }),
  phases: z.array(phaseSchema),
  locks: z.array(lockSchema),
})
