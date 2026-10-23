// Extracted from The Last Light scripts/pipeline/blockout-format.ts (92e6704): the blockout file,
// docs/art/blockout-<scene>/blockout.json, as Zod schemas. Rooms are sectors written as corner loops; an opening
// joins two rooms' facing walls; boxes, hotspots, lamps, anchors, nav and camera zones are the things in them.
// The game's own `validate` decides whether a level is sound (ED3D.2); a schema only says whether it is shaped.
import { z } from 'zod'
import {
  type MassDef,
  massSchema,
  type PartialTrim,
  type Point,
  pairSchema,
  partialTrimSchema,
  pointSchema,
  type WallDef,
  wallSchema,
} from './sector.schema'

/** A wall as written: a cutaway group's name, or WallDef fields with an optional preset (a key of `walls`) to start from. */
export type WallRef = string | (WallDef & { readonly preset?: string | undefined })

const wallRefSchema: z.ZodType<WallRef> = z.union([
  z.string(),
  z.intersection(wallSchema, z.looseObject({ preset: z.string().optional() })),
])

/** `[x, z]` starts a plain solid wall to the next corner; the third element, when there is one, says what else it is. */
export type BlockoutCorner = readonly [number, number, (WallRef | undefined)?]

const cornerSchema: z.ZodType<BlockoutCorner> = z.tuple([z.number(), z.number(), wallRefSchema.optional()])

/** Sector look fields a room can take from a named style. */
export interface Style {
  readonly floorTexture?: string | undefined
  readonly ceilingTexture?: string | undefined
  readonly wallTexture?: string | undefined
  readonly trim?: PartialTrim | undefined
}

export const styleSchema: z.ZodType<Style> = z.looseObject({
  floorTexture: z.string().optional(),
  ceilingTexture: z.string().optional(),
  wallTexture: z.string().optional(),
  trim: partialTrimSchema.optional(),
})

export interface Room {
  readonly id: string
  readonly zone: string
  readonly floor: number
  readonly ceiling: number
  /** Shade, Build-style: 1 is normal, lower is darker. */
  readonly light: number
  /** Ceiling cut away for the overhead camera. */
  readonly open?: boolean | undefined
  readonly floorTexture?: string | undefined
  readonly ceilingTexture?: string | undefined
  readonly wallTexture?: string | undefined
  readonly trim?: PartialTrim | undefined
  readonly style?: string | undefined
  /** Corners in order; each carries the wall that runs from it to the next corner. */
  readonly corners: readonly BlockoutCorner[]
  readonly holes?: readonly (readonly BlockoutCorner[])[] | undefined
}

export const roomSchema: z.ZodType<Room> = z.looseObject({
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
  style: z.string().optional(),
  corners: z.array(cornerSchema),
  holes: z.array(z.array(cornerSchema)).optional(),
})

/** An opening between two rooms' facing walls: the generator splits both and, when they stand apart, adds the connector. */
export interface Opening {
  readonly id: string
  readonly from: string
  readonly to: string
  /** Where along the walls (x for a wall at constant z, z for a wall at constant x), in metres. */
  readonly span: readonly [number, number]
  readonly zone?: string | undefined
  readonly floor?: number | undefined
  readonly ceiling?: number | undefined
  readonly light?: number | undefined
  readonly open?: boolean | undefined
  readonly style?: string | undefined
  /** The connector's two side walls. */
  readonly side?: WallRef | undefined
  /** The door box that closes it, if any. */
  readonly door?: string | undefined
}

export const openingSchema: z.ZodType<Opening> = z.looseObject({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  span: pairSchema,
  zone: z.string().optional(),
  floor: z.number().optional(),
  ceiling: z.number().optional(),
  light: z.number().optional(),
  open: z.boolean().optional(),
  style: z.string().optional(),
  side: wallRefSchema.optional(),
  door: z.string().optional(),
})

/** Attaches an item to a box (`box:<id>`) or a wall (`wall:<room>/<corner index>`), so a readback moves them together. */
export type On = `box:${string}` | `wall:${string}`

export const onSchema: z.ZodType<On> = z.templateLiteral([z.enum(['box', 'wall']), ':', z.string()])

export type BoxKind = 'desk' | 'bench' | 'bed' | 'exit' | 'door' | 'furniture'
export type BoxRole = 'collider' | 'seat' | 'door'

export interface BlockoutBox {
  readonly id: string
  readonly x: number
  readonly z: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly d: number
  readonly kind: BoxKind
  readonly role: BoxRole
}

export const boxSchema: z.ZodType<BlockoutBox> = z.looseObject({
  id: z.string(),
  x: z.number(),
  z: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  d: z.number(),
  kind: z.enum(['desk', 'bench', 'bed', 'exit', 'door', 'furniture']),
  role: z.enum(['collider', 'seat', 'door']),
})

export interface BlockoutHotspot {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly z: number
  readonly name: string
  readonly reach: number
  /** A hiding place: a bare-handed use hides the player here, and another brings them out. */
  readonly hide?: true | undefined
  readonly on?: On | undefined
}

export const hotspotSchema: z.ZodType<BlockoutHotspot> = z.looseObject({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  name: z.string(),
  reach: z.number(),
  hide: z.literal(true).optional(),
  on: onSchema.optional(),
})

export interface BlockoutLamp {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly z: number
  readonly range: number
  readonly radius: number
  readonly color: readonly [number, number, number]
  readonly kind?: string | undefined
  readonly on?: On | undefined
}

export const lampSchema: z.ZodType<BlockoutLamp> = z.looseObject({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  range: z.number(),
  radius: z.number(),
  color: z.tuple([z.number(), z.number(), z.number()]),
  kind: z.string().optional(),
  on: onSchema.optional(),
})

export interface Anchor {
  readonly x: number
  readonly z: number
  readonly y?: number | undefined
  readonly radius?: number | undefined
  readonly on?: On | undefined
}

export const anchorSchema: z.ZodType<Anchor> = z.looseObject({
  x: z.number(),
  z: z.number(),
  y: z.number().optional(),
  radius: z.number().optional(),
  on: onSchema.optional(),
})

/** Exclusive bounds; null leaves that side open. */
export interface Area {
  readonly x?: readonly [number | null, number | null] | undefined
  readonly z?: readonly [number | null, number | null] | undefined
}

const boundsSchema = z.tuple([z.number().nullable(), z.number().nullable()])

export const areaSchema: z.ZodType<Area> = z.looseObject({
  x: boundsSchema.optional(),
  z: boundsSchema.optional(),
})

export type Enter =
  | { readonly past: number }
  | {
      readonly shift: {
        readonly x?: number | { readonly awayFrom: number; readonly by: number } | undefined
        readonly z?: number | undefined
      }
    }

export const enterSchema: z.ZodType<Enter> = z.union([
  z.looseObject({ past: z.number() }),
  z.looseObject({
    shift: z.looseObject({
      x: z.union([z.number(), z.looseObject({ awayFrom: z.number(), by: z.number() })]).optional(),
      z: z.number().optional(),
    }),
  }),
])

export interface ZoneSpec {
  readonly id: string
  readonly look: readonly [number, number, number]
  readonly distance: number
  readonly x?: number | undefined
  readonly hysteresis?: number | undefined
  readonly follow?: number | undefined
  readonly depthFollow?: { readonly rate: number; readonly about: number } | undefined
  /** Membership. The first zone has none (the rest of the map); later zones are carved out of earlier ones. */
  readonly area?: Area | undefined
  readonly enter?: Enter | undefined
}

export const zoneSchema: z.ZodType<ZoneSpec> = z.looseObject({
  id: z.string(),
  look: z.tuple([z.number(), z.number(), z.number()]),
  distance: z.number(),
  x: z.number().optional(),
  hysteresis: z.number().optional(),
  follow: z.number().optional(),
  depthFollow: z.looseObject({ rate: z.number(), about: z.number() }).optional(),
  area: areaSchema.optional(),
  enter: enterSchema.optional(),
})

/** A nav edge: two node names and, optionally, the door box it passes through. */
export type NavEdge = readonly [string, string, (string | undefined)?]

export interface Nav {
  /** Derive nodes and edges from rooms and openings (default true); the lists below add to them. */
  readonly derive?: boolean | undefined
  readonly nodes?: Readonly<Record<string, Point & { readonly on?: On | undefined }>> | undefined
  readonly edges?: readonly NavEdge[] | undefined
  /** Derived edges to leave out. */
  readonly drop?: readonly (readonly [string, string])[] | undefined
  readonly patrol?: readonly string[] | undefined
}

export const navSchema: z.ZodType<Nav> = z.looseObject({
  derive: z.boolean().optional(),
  nodes: z
    .record(z.string(), z.intersection(pointSchema, z.looseObject({ on: onSchema.optional() })))
    .optional(),
  edges: z.array(z.tuple([z.string(), z.string(), z.string().optional()])).optional(),
  drop: z.array(z.tuple([z.string(), z.string()])).optional(),
  patrol: z.array(z.string()).optional(),
})

/** An old export name the generated file keeps until the anchor swap: a path, an object of paths, or a list of strings. */
export type ExportValue = string | Readonly<Record<string, string>> | readonly string[]

export const exportValueSchema: z.ZodType<ExportValue> = z.union([
  z.string(),
  z.record(z.string(), z.string()),
  z.array(z.string()),
])

export interface Spawn {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly facing: number
}

export interface Blockout {
  readonly scene: string
  readonly styles?: Readonly<Record<string, Style>> | undefined
  readonly walls?: Readonly<Record<string, WallDef>> | undefined
  readonly rooms: readonly Room[]
  readonly openings?: readonly Opening[] | undefined
  readonly masses?: readonly MassDef[] | undefined
  readonly spawn: Spawn
  readonly boxes: readonly BlockoutBox[]
  readonly hotspots: readonly BlockoutHotspot[]
  readonly lamps: readonly BlockoutLamp[]
  readonly bounce?: readonly (readonly [number, number, number])[] | undefined
  readonly nav: Nav
  readonly zones: readonly ZoneSpec[]
  readonly anchors?: Readonly<Record<string, Anchor>> | undefined
  readonly exports?: Readonly<Record<string, ExportValue>> | undefined
}

export const blockoutSchema: z.ZodType<Blockout> = z.looseObject({
  scene: z.string(),
  styles: z.record(z.string(), styleSchema).optional(),
  walls: z.record(z.string(), wallSchema).optional(),
  rooms: z.array(roomSchema),
  openings: z.array(openingSchema).optional(),
  masses: z.array(massSchema).optional(),
  spawn: z.looseObject({ x: z.number(), y: z.number(), z: z.number(), facing: z.number() }),
  boxes: z.array(boxSchema),
  hotspots: z.array(hotspotSchema),
  lamps: z.array(lampSchema),
  bounce: z.array(z.tuple([z.number(), z.number(), z.number()])).optional(),
  nav: navSchema,
  zones: z.array(zoneSchema),
  anchors: z.record(z.string(), anchorSchema).optional(),
  exports: z.record(z.string(), exportValueSchema).optional(),
})
