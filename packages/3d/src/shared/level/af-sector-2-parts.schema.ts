// The parts of an `af-sector/2` room: surfaces, planes, what is set into a wall (decor, a window grid), bands, a wall,
// a hinged door, and dressing. Pure validators like the level's (no defaults, an unknown member kept), kept apart from
// the level so both files stay a size a person can read.
import { z } from 'zod'
import { OCCLUDES } from './occlude.ts'
import {
  type DoorDef,
  doorSchema,
  type PartialTrim,
  pairSchema,
  partialTrimSchema,
  TRIM_PIECES,
  type WindowDef,
  windowSchema,
} from './sector.schema.ts'

export type Pair = readonly [number, number]

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

export const planeObjectSchema: z.ZodType<Plane> = z.looseObject({
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

export const bandSchema: z.ZodType<Band> = z.looseObject({ surface: surfaceSchema, height: z.number() })

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

export const corner2Schema: z.ZodType<AfCorner2> = z.tuple([z.number(), z.number(), afWall2Schema.optional()])

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

export const sectorDoorSchema: z.ZodType<SectorDoor> = z.looseObject({
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

export const kitSurfacesSchema: z.ZodType<KitSurfaces> = z.looseObject({
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
