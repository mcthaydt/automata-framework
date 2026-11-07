// The `af-sector/2` level file: `/1`, the sector vocabulary Last Light proved, plus what EnvironmentBuilder's
// map carries, so the game, the editor and the world builder read one format. A pure validator like `/1`'s (no
// defaults, an unknown member kept) with one exception: a plane written as a bare number reads as `{ z }`, so every
// reader after it sees one shape. Fields land by the table in the level spec; the builder's `verts`/`rect` and its walls by edge
// index are converted by the world-kit extension's converter, never read here.
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
import { OCCLUDES } from './occlude.ts'
import {
  type DoorDef,
  doorSchema,
  type MassDef,
  massSchema,
  type PartialTrim,
  pairSchema,
  partialTrimSchema,
  TRIM_PIECES,
  type WindowDef,
  windowSchema,
} from './sector.schema.ts'

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
      message: `${format} is not a version this reader reads (${AF_SECTOR_2_FORMAT})`,
    })
})

type Pair = readonly [number, number]

/** A tile with its placement (Mapster32's picnum, repeat, pan, alignment and quarter turn): where a swatch starts. */
export interface SurfaceTex {
  readonly tile: string
  readonly repeat?: Pair | undefined
  readonly pan?: Pair | undefined
  readonly align?: 'wall' | 'world' | 'object' | undefined
  readonly turn?: boolean | undefined
}

/** A swatch name, placed in the world, or a swatch with its placement. */
export type Surface = string | SurfaceTex

const surfaceTexSchema: z.ZodType<SurfaceTex> = z.looseObject({
  tile: z.string(),
  repeat: pairSchema.optional(),
  pan: pairSchema.optional(),
  align: z.enum(['wall', 'world', 'object']).optional(),
  turn: z.boolean().optional(),
})

export const surfaceSchema: z.ZodType<Surface> = z.union([z.string(), surfaceTexSchema])

/** A floor or a ceiling: its height, its slope (rise per metre along x and z), a parallax sky, a surface. */
export interface Plane {
  readonly z: number
  readonly slope?: Pair | undefined
  readonly sky?: boolean | undefined
  readonly surface?: Surface | undefined
}

const planeObjectSchema: z.ZodType<Plane> = z.looseObject({
  z: z.number(),
  slope: pairSchema.optional(),
  sky: z.boolean().optional(),
  surface: surfaceSchema.optional(),
})

/** A plane, or a number for its height alone; either way what comes out is the plane. */
export const planeSchema: z.ZodType<Plane> = z.union([
  z.number().transform((height): Plane => ({ z: height })),
  planeObjectSchema,
])

/** Something on a wall: a window, a door, a shopfront or a sign. `pos` is its centre along the wall. */
export interface Decor {
  readonly kind: 'window' | 'door' | 'shop' | 'sign'
  readonly pos: number
  readonly width: number
  readonly height?: number | undefined
  readonly sill?: number | undefined
  readonly glass?: string | undefined
  readonly frame?: string | undefined
  readonly swatch?: string | undefined
  readonly awning?: string | undefined
  /** A lit window's interior, or `none`. */
  readonly interior?: 'curtains' | 'blinds' | 'plant' | 'figure' | 'lamp' | 'none' | undefined
  readonly lit?: boolean | undefined
  readonly seed?: number | undefined
  /** A sign's words, and for a neon sign its tube's swatch. */
  readonly text?: readonly string[] | undefined
  readonly neon?: string | undefined
  /** The distance a sign is read from, for its lettering's size. */
  readonly seen?: number | undefined
}

export const decorSchema: z.ZodType<Decor> = z.looseObject({
  kind: z.enum(['window', 'door', 'shop', 'sign']),
  pos: z.number(),
  width: z.number(),
  height: z.number().optional(),
  sill: z.number().optional(),
  glass: z.string().optional(),
  frame: z.string().optional(),
  swatch: z.string().optional(),
  awning: z.string().optional(),
  interior: z.enum(['curtains', 'blinds', 'plant', 'figure', 'lamp', 'none']).optional(),
  lit: z.boolean().optional(),
  seed: z.number().optional(),
  text: z.array(z.string()).optional(),
  neon: z.string().optional(),
  seen: z.number().optional(),
})

/** A grid of windows over a facade: cols × rows from a height, a seeded share lit. */
export interface WindowGrid {
  readonly from: number
  readonly rows: number
  readonly cols: number
  readonly width: number
  readonly height: number
  readonly gap: number
  readonly lit?: number | undefined
  readonly seed?: number | undefined
  readonly glass?: string | undefined
  readonly glassLit?: string | undefined
  readonly frame?: string | undefined
}

export const windowGridSchema: z.ZodType<WindowGrid> = z.looseObject({
  from: z.number(),
  rows: z.number(),
  cols: z.number(),
  width: z.number(),
  height: z.number(),
  gap: z.number(),
  lit: z.number().optional(),
  seed: z.number().optional(),
  glass: z.string().optional(),
  glassLit: z.string().optional(),
  frame: z.string().optional(),
})

/** A band with its own surface at a height: a dado from the foot up, a cornice under the ceiling. */
export interface Band {
  readonly surface: Surface
  readonly height: number
}

const bandSchema: z.ZodType<Band> = z.looseObject({ surface: surfaceSchema, height: z.number() })

/**
 * One wall. `/1`'s members (the camera-zone ones, `hideFrom` and `cut`, included) and the builder's: the surface above
 * and below the dado, the trim, skirting and rail, a cornice, an open edge, the things set into it. `trim` is `/1`'s
 * heights or the builder's surface; an object with a `tile` is the surface.
 */
export interface AfWall2 {
  readonly next?: string | undefined
  /** The wall's surface (`/1`'s `texture`). */
  readonly surface?: Surface | undefined
  readonly upper?: Surface | undefined
  readonly lower?: Surface | undefined
  readonly trim?: PartialTrim | Surface | undefined
  readonly trimTexture?: Readonly<Partial<Record<(typeof TRIM_PIECES)[number], string>>> | undefined
  readonly trimDepth?: Readonly<Partial<Record<(typeof TRIM_PIECES)[number], number>>> | undefined
  readonly skirting?: number | undefined
  readonly rail?: number | undefined
  readonly dado?: Band | undefined
  readonly cornice?: Band | undefined
  /** An open edge: no wall at all. */
  readonly none?: boolean | undefined
  readonly decor?: readonly Decor[] | undefined
  readonly windows?: WindowGrid | undefined
  readonly pan?: Pair | undefined
  readonly frame?: boolean | undefined
  readonly mask?: 'glass' | 'bars' | undefined
  readonly block?: boolean | undefined
  readonly maskTop?: number | undefined
  readonly hatch?: Pair | undefined
  readonly handrail?: number | undefined
  readonly hideFrom?: readonly string[] | undefined
  readonly cut?: string | undefined
  readonly window?: WindowDef | undefined
  readonly door?: DoorDef | undefined
  readonly pilaster?: { readonly start?: Pair | undefined; readonly end?: Pair | undefined } | undefined
  readonly thick?: number | undefined
  readonly occlude?: (typeof OCCLUDES)[number] | undefined
}

const trimOrSurfaceSchema = z.union([surfaceSchema, partialTrimSchema])

export const afWall2Schema: z.ZodType<AfWall2> = z.looseObject({
  next: z.string().optional(),
  surface: surfaceSchema.optional(),
  upper: surfaceSchema.optional(),
  lower: surfaceSchema.optional(),
  trim: trimOrSurfaceSchema.optional(),
  trimTexture: z.partialRecord(z.enum(TRIM_PIECES), z.string()).optional(),
  trimDepth: z.partialRecord(z.enum(TRIM_PIECES), z.number()).optional(),
  skirting: z.number().optional(),
  rail: z.number().optional(),
  dado: bandSchema.optional(),
  cornice: bandSchema.optional(),
  none: z.boolean().optional(),
  decor: z.array(decorSchema).optional(),
  windows: windowGridSchema.optional(),
  pan: pairSchema.optional(),
  frame: z.boolean().optional(),
  mask: z.enum(['glass', 'bars']).optional(),
  block: z.boolean().optional(),
  maskTop: z.number().optional(),
  hatch: pairSchema.optional(),
  handrail: z.number().optional(),
  hideFrom: z.array(z.string()).optional(),
  cut: z.string().optional(),
  window: windowSchema.optional(),
  door: doorSchema.optional(),
  pilaster: z.looseObject({ start: pairSchema.optional(), end: pairSchema.optional() }).optional(),
  thick: z.number().optional(),
  occlude: z.enum(OCCLUDES).optional(),
})

/** A corner starts the wall that runs from it to the next corner. */
export type AfCorner2 = readonly [number, number, (AfWall2 | undefined)?]

const corner2Schema: z.ZodType<AfCorner2> = z.tuple([z.number(), z.number(), afWall2Schema.optional()])

/** A hinged door in a doorway sector: where it is open, how near the eye opens it, which way and how fast it swings. */
export interface SectorDoor {
  /** The time window (seconds) it stands open in. */
  readonly open?: Pair | undefined
  /** It opens while a first-person camera is within this many metres. */
  readonly near?: number | undefined
  readonly speed?: number | undefined
  /** Which side of the doorway it swings into: −1 or +1. */
  readonly into?: number | undefined
  readonly hinge?: 'start' | 'end' | undefined
  readonly surface?: Surface | undefined
  readonly handle?: string | undefined
}

const sectorDoorSchema: z.ZodType<SectorDoor> = z.looseObject({
  open: pairSchema.optional(),
  near: z.number().optional(),
  speed: z.number().optional(),
  into: z.number().optional(),
  hinge: z.enum(['start', 'end']).optional(),
  surface: surfaceSchema.optional(),
  handle: z.string().optional(),
})

/** A kit's surfaces, part by part. */
export interface KitSurfaces {
  readonly floor?: Surface | undefined
  readonly ceiling?: Surface | undefined
  readonly wall?: Surface | undefined
  readonly dado?: Band | undefined
  readonly rail?: number | undefined
  readonly skirting?: number | undefined
  readonly cornice?: Band | undefined
}

const kitSurfacesSchema: z.ZodType<KitSurfaces> = z.looseObject({
  floor: surfaceSchema.optional(),
  ceiling: surfaceSchema.optional(),
  wall: surfaceSchema.optional(),
  dado: bandSchema.optional(),
  rail: z.number().optional(),
  skirting: z.number().optional(),
  cornice: bandSchema.optional(),
})

/** One generated piece moved or changed, by its id. */
export interface Pin {
  readonly at?: readonly number[] | undefined
  readonly angle?: number | undefined
  readonly use?: string | undefined
  readonly with?: Readonly<Record<string, unknown>> | undefined
}

/** Dressing a sector, or a whole level: a purpose kit by name, how full, a seed, and edits as data. */
export interface Dress {
  readonly as: string
  readonly density?: number | undefined
  readonly seed?: number | undefined
  /** How much floor clutter: 0 none … 2 derelict. */
  readonly grime?: number | undefined
  /** Level only: false removes all dressing. */
  readonly keep?: boolean | undefined
  /** Generated pieces taken out, by id `<sector>:<layer>:<n>`. */
  readonly remove?: readonly string[] | undefined
  readonly pin?: Readonly<Record<string, Pin>> | undefined
  /** Over the kit's surfaces; false keeps the sector's own. */
  readonly surfaces?: KitSurfaces | false | undefined
}

export const dressSchema: z.ZodType<Dress> = z.looseObject({
  as: z.string(),
  density: z.number().optional(),
  seed: z.number().optional(),
  grime: z.number().optional(),
  keep: z.boolean().optional(),
  remove: z.array(z.string()).optional(),
  pin: z
    .record(
      z.string(),
      z.looseObject({
        at: z.array(z.number()).optional(),
        angle: z.number().optional(),
        use: z.string().optional(),
        with: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .optional(),
  surfaces: z.union([kitSurfacesSchema, z.literal(false)]).optional(),
})

export interface AfSectorEntry2 {
  readonly id: string
  readonly floor: Plane
  readonly ceiling: Plane
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

export const afSectorEntry2Schema: z.ZodType<AfSectorEntry2> = z.looseObject({
  id: z.string(),
  floor: planeSchema,
  ceiling: planeSchema,
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

export interface AfSector2 {
  readonly format: string
  /** The file's name; the area's id. */
  readonly name: string
  /** A person's name for it. */
  readonly title?: string | undefined
  readonly materials?: Readonly<Record<string, AfMaterial>> | undefined
  readonly styles?: Readonly<Record<string, Style>> | undefined
  readonly sectors: readonly AfSectorEntry2[]
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

export const afSector2Schema: z.ZodType<AfSector2> = z.looseObject({
  format: formatSchema,
  name: z.string(),
  title: z.string().optional(),
  materials: z.record(z.string(), afMaterialSchema).optional(),
  styles: z.record(z.string(), styleSchema).optional(),
  sectors: z.array(afSectorEntry2Schema),
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
