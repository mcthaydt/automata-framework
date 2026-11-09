// The Build-style sector vocabulary (trim, walls with windows and doors, sectors, masses) as Zod schemas, and the
// constants every reader of a map shares (provenance: docs/provenance/sources.md). The types there are the contract; a schema is a
// pure validator, so it adds no defaults and changes nothing, and an unknown member is kept (looseObject) so the
// codec never deletes what a newer file carries.

import { z } from 'zod'
import type { Occlude } from './occlude.ts'

export interface Point {
  readonly x: number
  readonly z: number
}

export const pointSchema: z.ZodType<Point> = z.looseObject({ x: z.number(), z: z.number() })

/** A pair of numbers: a span, a pan, a pilaster's width and depth. */
export const pairSchema: z.ZodType<readonly [number, number]> = z.tuple([z.number(), z.number()])

/** Trim heights in metres; 0 leaves that piece out. */
export interface Trim {
  readonly skirting: number
  readonly wainscot: number
  readonly rail: number
  readonly cap: boolean
  readonly capital?: number | undefined
}

export const trimSchema: z.ZodType<Trim> = z.looseObject({
  skirting: z.number(),
  wainscot: z.number(),
  rail: z.number(),
  cap: z.boolean(),
  capital: z.number().optional(),
})

/** The pieces of a trim a wall or a style may set one by one. */
export interface PartialTrim {
  readonly skirting?: number | undefined
  readonly wainscot?: number | undefined
  readonly rail?: number | undefined
  readonly cap?: boolean | undefined
  readonly capital?: number | undefined
}

export const partialTrimSchema: z.ZodType<PartialTrim> = z.looseObject({
  skirting: z.number().optional(),
  wainscot: z.number().optional(),
  rail: z.number().optional(),
  cap: z.boolean().optional(),
  capital: z.number().optional(),
})

/** A recessed window in a solid wall: `at` is its centre along the wall, in metres from the wall's start. */
export interface WindowDef {
  readonly at: number
  readonly width: number
  readonly y0: number
  readonly y1: number
  readonly bars?: number | undefined
  readonly moon?: boolean | undefined
}

export const windowSchema: z.ZodType<WindowDef> = z.looseObject({
  at: z.number(),
  width: z.number(),
  y0: z.number(),
  y1: z.number(),
  bars: z.number().optional(),
  moon: z.boolean().optional(),
})

/** A closed door set into a solid wall, with its casing; trims stop at it. */
export interface DoorDef {
  readonly at: number
  readonly width: number
  readonly height: number
  readonly id?: string | undefined
}

export const doorSchema: z.ZodType<DoorDef> = z.looseObject({
  at: z.number(),
  width: z.number(),
  height: z.number(),
  id: z.string().optional(),
})

export const TRIM_PIECES = ['skirting', 'wainscot', 'rail', 'capital'] as const

/** One wall: what it is made of, what is set into it, and how it joins the next sector. Every member is optional. */
export interface WallDef {
  /** Portal: the sector on the other side. */
  readonly next?: string | undefined
  /** Texture ids: the wall above the wainscot, and the wainscot. */
  readonly texture?: string | undefined
  readonly trimTexture?: Readonly<Partial<Record<(typeof TRIM_PIECES)[number], string>>> | undefined
  readonly trimDepth?: Readonly<Partial<Record<(typeof TRIM_PIECES)[number], number>>> | undefined
  /** Texel-locked panning, in texels (32 per metre): along the wall, and up. */
  readonly pan?: readonly [number, number] | undefined
  readonly trim?: PartialTrim | undefined
  /** Portal only: a door casing round the opening on this side. */
  readonly frame?: boolean | undefined
  /** Portal only: a masked wall in the opening, and whether it blocks walking. */
  readonly mask?: 'glass' | 'bars' | undefined
  readonly block?: boolean | undefined
  /** Top of the masked wall above the sector floor, and an open hatch in it (metres along the wall). */
  readonly maskTop?: number | undefined
  readonly hatch?: readonly [number, number] | undefined
  /** A handrail on brackets at this height, along the wall's uninterrupted runs. */
  readonly handrail?: number | undefined
  /** Camera zones that always cut this wall away. */
  readonly hideFrom?: readonly string[] | undefined
  readonly window?: WindowDef | undefined
  readonly door?: DoorDef | undefined
  /** A pilaster built out of the wall at its start or end: [width along the wall, depth into the room]. */
  readonly pilaster?:
    | {
        readonly start?: readonly [number, number] | undefined
        readonly end?: readonly [number, number] | undefined
      }
    | undefined
  /** Cutaway group: walls in one group hide together when they stand between the camera and the player. */
  readonly cut?: string | undefined
  /** Masonry thickness behind the face, for the wall top and colliders. */
  readonly thick?: number | undefined
  /**
   * How the angled game camera treats the wall (`occlude.ts`): `cut`, `fade` or `never`; absent is `cut`. An
   * `af-sector/1` member only, so `wallSchema` leaves it to `afWallSchema`.
   */
  readonly occlude?: Occlude | undefined
}

const trimPieceRecord = <T extends z.ZodType>(value: T) => z.partialRecord(z.enum(TRIM_PIECES), value)

export const wallSchema: z.ZodType<WallDef> = z.looseObject({
  next: z.string().optional(),
  texture: z.string().optional(),
  trimTexture: trimPieceRecord(z.string()).optional(),
  trimDepth: trimPieceRecord(z.number()).optional(),
  pan: pairSchema.optional(),
  trim: partialTrimSchema.optional(),
  frame: z.boolean().optional(),
  mask: z.enum(['glass', 'bars']).optional(),
  block: z.boolean().optional(),
  maskTop: z.number().optional(),
  hatch: pairSchema.optional(),
  handrail: z.number().optional(),
  hideFrom: z.array(z.string()).optional(),
  window: windowSchema.optional(),
  door: doorSchema.optional(),
  pilaster: z.looseObject({ start: pairSchema.optional(), end: pairSchema.optional() }).optional(),
  cut: z.string().optional(),
  thick: z.number().optional(),
})

/** Solid masonry tops between rooms, seen where a wall is cut away or from above. */
export interface MassDef {
  readonly points: readonly Point[]
  readonly top: number
  readonly cut?: string | undefined
  /** `faces`: polygon edges (by index) that get an outward wall face from `from` up to `top`. */
  readonly faces?: { readonly edges: readonly number[]; readonly from: number } | undefined
}

export const massSchema: z.ZodType<MassDef> = z.looseObject({
  points: z.array(pointSchema),
  top: z.number(),
  cut: z.string().optional(),
  faces: z.looseObject({ edges: z.array(z.number()), from: z.number() }).optional(),
})

/** Masonry thickness behind a wall's face when the wall does not say. */
export const WALL_THICK = 0.125
/** A floor step a person can walk up. Anything taller is a wall. */
export const STEP = 0.25
/** What a sector's trim is, laid under whatever the sector and then its walls set. */
export const DEFAULT_TRIM: Trim = { skirting: 0.14, wainscot: 1.14, rail: 0.08, cap: true }

/** A corner starts the wall that runs from it to the next corner. */
export type Corner = [x: number, z: number, wall?: WallDef]

// Zod types an optional tuple element as `WallDef | undefined`; `Corner` keeps the hole (exact optional types), and
// the parse never writes an explicit undefined, so the narrower type is what comes out.
export const cornerSchema: z.ZodType<Corner> = z.tuple([
  z.number(),
  z.number(),
  wallSchema.optional(),
]) as z.ZodType<Corner>

/** A sector as the engine takes it: one floor and ceiling, a loop of corners and optional holes. */
export interface SectorDef {
  id: string
  zone: string
  floor: number
  ceiling: number
  /** Shade, Build-style: 1 is normal, lower is darker. */
  light: number
  open?: boolean | undefined
  floorTexture?: string | undefined
  ceilingTexture?: string | undefined
  wallTexture?: string | undefined
  trim?: PartialTrim | undefined
  corners: Corner[]
  holes?: Corner[][] | undefined
}

export const sectorDefSchema: z.ZodType<SectorDef> = z.looseObject({
  id: z.string(),
  zone: z.string(),
  floor: z.number(),
  ceiling: z.number(),
  light: z.number(),
  open: z.boolean().optional(),
  floorTexture: z.string().optional(),
  ceilingTexture: z.string().optional(),
  wallTexture: z.string().optional(),
  trim: partialTrimSchema.optional(),
  corners: z.array(cornerSchema),
  holes: z.array(z.array(cornerSchema)).optional(),
})
