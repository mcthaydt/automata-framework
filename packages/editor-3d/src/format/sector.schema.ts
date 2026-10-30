// Extracted from The Last Light src/game/sector-format.ts (92e6704): the Build-style sector vocabulary
// (trim, walls with windows and doors, masses) as Zod schemas. The types there are the contract; a schema is a
// pure validator, so it adds no defaults and changes nothing, and an unknown member is kept (looseObject) so the
// codec never deletes what a newer file carries.
import type { Occlude } from '@mcthaydt/automata-render-pixi3d/camera-view'
import { z } from 'zod'

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
/**
 * How the angled game camera treats a wall (ED3D.4b, the 3D direction spec §4.2): `cut` is cut away when the camera is on
 * its outer side, `fade` is drawn at a quarter of its opacity there, `never` always stays. Not in Last Light: an `af-sector/1`
 * member, so a Last Light file never holds one. The list is render-pixi3d's `camera-view` (its one owner, M3.4c).
 */
export { OCCLUDES, type Occlude } from '@mcthaydt/automata-render-pixi3d/camera-view'

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
  /** `af-sector/1` only; absent is `cut`. */
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
