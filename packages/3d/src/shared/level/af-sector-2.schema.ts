// The `af-sector/2` level file: `/1`, the sector vocabulary, plus what a map carries, so the game, the editor and the
// world builder read one format. A pure validator like `/1`'s (no defaults, an unknown member kept) with one exception:
// a plane written as a bare number reads as `{ z }`, so every reader after it sees one shape (`afSector2Schema`).
// `afSector2FileSchema` reads the same file *as written* (a plane stays a number or an object): an editor patches text
// from a model that must equal what the text parses to, so it cannot hold the reader's reshaped one. Both come from one
// function, so they cannot drift. Fields land by the table in the level spec; the builder's `verts`/`rect` and its walls
// by edge index are converted by the world-kit extension's converter, never read here.
import { z } from 'zod'
import {
  type AfEntity,
  type AfEntityDef,
  type AfMaterial,
  afEntityDefSchema,
  afEntitySchema,
  afFormatVersion,
  afMaterialSchema,
  type Style,
  styleSchema,
} from './af-sector.schema.ts'
import {
  type AfCorner2,
  corner2Schema,
  type Dress,
  dressSchema,
  type Pair,
  type Plane,
  planeObjectSchema,
  planeSchema,
  type SectorDoor,
  sectorDoorSchema,
} from './af-sector-2-parts.schema.ts'
import type { WrittenPlane } from './plane.ts'
import { type MassDef, massSchema, type PartialTrim, pairSchema, partialTrimSchema } from './sector.schema.ts'

export * from './af-sector-2-parts.schema.ts'

export const AF_SECTOR_2_FORMAT = 'af-sector/2'

/** Major 2 opens (a newer minor with a warning, which the codec adds); any other major is refused. */
const formatSchema = z.string().superRefine((format, context) => {
  const version = afFormatVersion(format)
  if (version === undefined)
    context.addIssue({
      code: 'custom',
      message: `${format} is not af-sector/<major> or af-sector/<major>.<minor>`,
    })
  else if (version.major !== 2)
    context.addIssue({
      code: 'custom',
      message: `${format} is not a version this editor reads (${AF_SECTOR_2_FORMAT})`,
    })
})

/** A room. `P` is how its planes are held: `Plane` for every reader, `WrittenPlane` for the file as written. */
export interface AfSectorEntry2<P = Plane> {
  readonly id: string
  readonly floor: P
  readonly ceiling: P
  /** Shade, Build-style: 1 is normal, lower is darker. */
  readonly light: number
  /** A name the sim's rules can read (the `sectors` extension reads it). */
  readonly zone?: string | undefined
  /** The floor is a drop the player falls into (: the game's pits as a flag, not as a floor below 0). */
  readonly pit?: boolean | undefined
  /** Ceiling cut away for the overhead view. */
  readonly open?: boolean | undefined
  readonly style?: string | undefined
  readonly floorTexture?: string | undefined
  readonly ceilingTexture?: string | undefined
  readonly wallTexture?: string | undefined
  readonly trim?: PartialTrim | undefined
  /** The id of the camera view the game takes while the player is in this sector. */
  readonly view?: string | undefined
  readonly grime?: number | undefined
  readonly door?: SectorDoor | undefined
  readonly dress?: Dress | undefined
  readonly corners: readonly AfCorner2[]
  readonly holes?: readonly (readonly AfCorner2[])[] | undefined
}

/** A thing placed in the level: a preset (`use`) or a generator (`kind`), where it stands, its turn, its parameters. */
export interface PropPlace {
  readonly id: string
  readonly use?: string | undefined
  readonly kind?: string | undefined
  /** `[x, z]` on the floor, or `[x, z, height]`. */
  readonly at: readonly number[]
  /** Degrees clockwise from east (90 faces south). */
  readonly angle?: number | undefined
  readonly with?: Readonly<Record<string, unknown>> | undefined
  /** The parallax layer it is drawn in: `far`, `mid` or `near`. */
  readonly layer?: string | undefined
}

const positionSchema = z.array(z.number()).min(2).max(3)

export const propPlaceSchema: z.ZodType<PropPlace> = z.looseObject({
  id: z.string(),
  use: z.string().optional(),
  kind: z.string().optional(),
  at: positionSchema,
  angle: z.number().optional(),
  with: z.record(z.string(), z.unknown()).optional(),
  layer: z.string().optional(),
})

/** A character placed in the level: presentation only; the sim's things stay `entities`. */
export interface CastPlace {
  readonly id: string
  readonly who: string
  readonly pose?: string | undefined
  readonly at: readonly number[]
  readonly angle?: number | undefined
  /** It walks here over a clip. */
  readonly to?: Pair | undefined
}

export const castPlaceSchema: z.ZodType<CastPlace> = z.looseObject({
  id: z.string(),
  who: z.string(),
  pose: z.string().optional(),
  at: positionSchema,
  angle: z.number().optional(),
  to: pairSchema.optional(),
})

/** A lamp: a point light of a kind from the look's lamp kit, at `[x, z, height]`. */
export interface LampPlace {
  readonly id: string
  readonly kind: string
  readonly at: readonly number[]
  readonly color?: string | undefined
  readonly range?: number | undefined
  readonly level?: number | undefined
  readonly aim?: readonly number[] | undefined
  readonly cone?: number | undefined
  readonly flicker?: number | undefined
  readonly rate?: number | undefined
  readonly seed?: number | undefined
  readonly shaft?: boolean | undefined
  readonly flame?: boolean | undefined
}

export const lampPlaceSchema: z.ZodType<LampPlace> = z.looseObject({
  id: z.string(),
  kind: z.string(),
  at: positionSchema,
  color: z.string().optional(),
  range: z.number().optional(),
  level: z.number().optional(),
  aim: z.array(z.number()).optional(),
  cone: z.number().optional(),
  flicker: z.number().optional(),
  rate: z.number().optional(),
  seed: z.number().optional(),
  shaft: z.boolean().optional(),
  flame: z.boolean().optional(),
})

/** A time of day: a name from `time-of-day`, or a name (`preset`) with overrides. */
export type LevelTime =
  | string
  | (Readonly<Record<string, unknown>> & { readonly preset?: string | undefined })

const timeSchema: z.ZodType<LevelTime> = z.union([
  z.string(),
  z.looseObject({ preset: z.string().optional() }),
])

/** How far the eye sees and the mood grade. */
export interface LevelLook {
  readonly visibility?: number | undefined
  readonly grade?: string | undefined
}

/** A parallax silhouette on the horizon, and the layers that move against the camera. */
export interface LevelSky {
  readonly horizon?:
    | readonly {
        readonly kind: 'mountains' | 'hills' | 'city' | 'trees'
        readonly swatch: string
        readonly height: number
        readonly seed?: number | undefined
      }[]
    | undefined
  readonly layers?:
    | readonly { readonly name: string; readonly from: number; readonly factor: number }[]
    | undefined
}

const skySchema: z.ZodType<LevelSky> = z.looseObject({
  horizon: z
    .array(
      z.looseObject({
        kind: z.enum(['mountains', 'hills', 'city', 'trees']),
        swatch: z.string(),
        height: z.number(),
        seed: z.number().optional(),
      }),
    )
    .optional(),
  layers: z.array(z.looseObject({ name: z.string(), from: z.number(), factor: z.number() })).optional(),
})

/** What a level's frames must keep, read by the checks. */
export interface LevelReads {
  readonly minEdge?: number | undefined
  /** A waiver of the brightness rule, not a pass. */
  readonly hot?: boolean | undefined
}

/** A decal or a piece of lettering, carried as written; core draws none, the world-kit extension reads its fields. */
export type Marking = Readonly<Record<string, unknown>>

/** The level. `P` is how its planes are held, as for `AfSectorEntry2`. */
export interface AfSector2<P = Plane> {
  readonly format: string
  /** The file's name; the area's id. */
  readonly name: string
  /** A person's name for it. */
  readonly title?: string | undefined
  readonly materials?: Readonly<Record<string, AfMaterial>> | undefined
  readonly styles?: Readonly<Record<string, Style>> | undefined
  readonly sectors: readonly AfSectorEntry2<P>[]
  /** Solid blocks that are not sectors. */
  readonly masses?: readonly MassDef[] | undefined
  readonly props?: readonly PropPlace[] | undefined
  readonly cast?: readonly CastPlace[] | undefined
  readonly lamps?: readonly LampPlace[] | undefined
  readonly time?: LevelTime | undefined
  readonly look?: LevelLook | undefined
  /** Named cameras: the game's (`yawDeg`, `bounds`, …) and the builder's (`diorama`, `topdown`, `fp`). */
  readonly views?: Readonly<Record<string, Readonly<Record<string, unknown>>>> | undefined
  /** Camera paths for walkthroughs and stage scripts: `[x, z]` points, a look angle optional as a third value. */
  readonly paths?: Readonly<Record<string, readonly (readonly number[])[]>> | undefined
  readonly sky?: LevelSky | undefined
  /** Seeds generated maps and dressing. */
  readonly seed?: number | undefined
  /** How worn the place is: 0 pristine, 1 lived-in, 2 derelict. */
  readonly grime?: number | undefined
  readonly dress?: Dress | undefined
  readonly reads?: LevelReads | undefined
  readonly decals?: readonly Marking[] | undefined
  readonly lettering?: readonly Marking[] | undefined
  readonly entityDefs?: readonly AfEntityDef[] | undefined
  readonly entities?: readonly AfEntity[] | undefined
}

const markingSchema = z.array(z.record(z.string(), z.unknown()))

/** The room and level schemas over one way to hold a plane, so the two readers differ in nothing else. */
function levelSchemas<P>(plane: z.ZodType<P>): {
  readonly entry: z.ZodType<AfSectorEntry2<P>>
  readonly level: z.ZodType<AfSector2<P>>
} {
  const entry: z.ZodType<AfSectorEntry2<P>> = z.looseObject({
    id: z.string(),
    floor: plane,
    ceiling: plane,
    light: z.number(),
    zone: z.string().optional(),
    pit: z.boolean().optional(),
    open: z.boolean().optional(),
    style: z.string().optional(),
    floorTexture: z.string().optional(),
    ceilingTexture: z.string().optional(),
    wallTexture: z.string().optional(),
    trim: partialTrimSchema.optional(),
    view: z.string().optional(),
    grime: z.number().optional(),
    door: sectorDoorSchema.optional(),
    dress: dressSchema.optional(),
    corners: z.array(corner2Schema).min(3),
    holes: z.array(z.array(corner2Schema).min(3)).optional(),
  })

  const level: z.ZodType<AfSector2<P>> = z.looseObject({
    format: formatSchema,
    name: z.string(),
    title: z.string().optional(),
    materials: z.record(z.string(), afMaterialSchema).optional(),
    styles: z.record(z.string(), styleSchema).optional(),
    sectors: z.array(entry),
    masses: z.array(massSchema).optional(),
    props: z.array(propPlaceSchema).optional(),
    cast: z.array(castPlaceSchema).optional(),
    lamps: z.array(lampPlaceSchema).optional(),
    time: timeSchema.optional(),
    look: z.looseObject({ visibility: z.number().optional(), grade: z.string().optional() }).optional(),
    views: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
    paths: z.record(z.string(), z.array(z.array(z.number()))).optional(),
    sky: skySchema.optional(),
    seed: z.number().optional(),
    grime: z.number().optional(),
    dress: dressSchema.optional(),
    reads: z.looseObject({ minEdge: z.number().optional(), hot: z.boolean().optional() }).optional(),
    decals: markingSchema.optional(),
    lettering: markingSchema.optional(),
    entityDefs: z.array(afEntityDefSchema).optional(),
    entities: z.array(afEntitySchema).optional(),
  })
  return { entry, level }
}

const reader = levelSchemas<Plane>(planeSchema)
// A height as written is a number, or a plane with a slope. Say what was found when it is neither of those shapes.
const writtenPlaneSchema = z.union([z.number(), planeObjectSchema], {
  error: (issue) =>
    typeof issue.input === 'object' && issue.input !== null
      ? undefined
      : `Invalid input: expected number, received ${issue.input === null ? 'null' : typeof issue.input}`,
})
const written = levelSchemas<WrittenPlane>(writtenPlaneSchema)

export const afSectorEntry2Schema: z.ZodType<AfSectorEntry2> = reader.entry
export const afSector2Schema: z.ZodType<AfSector2> = reader.level

/** The level exactly as a file holds it: no plane is reshaped, so `JSON.parse(text)` and the parse are equal. */
export type AfSector2File = AfSector2<WrittenPlane>
export type AfSectorEntry2File = AfSectorEntry2<WrittenPlane>
export const afSector2FileSchema: z.ZodType<AfSector2File> = written.level
export const afSectorEntry2FileSchema: z.ZodType<AfSectorEntry2File> = written.entry
