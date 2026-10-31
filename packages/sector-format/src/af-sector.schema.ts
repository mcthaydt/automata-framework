// The native `af-sector/1` level file's envelope (ED3D spec §4.6, owned here since GAME-3D.1i so the game reads it
// without the editor; the exact shape is in the ED3D.1b plan): the sector
// vocabulary Last Light proved (corner loops with walls, portals, doors, windows, trim, heights, light), without the
// pieces that are Last Light's own (camera zones, the nav graph, openings as connector sectors, exports). Like the
// Last Light schemas it is a pure validator: no defaults, nothing changed, and an unknown member is kept so the codec
// never deletes what a newer file carries.
import { z } from 'zod'
import { OCCLUDES } from './occlude'
import {
  doorSchema,
  type PartialTrim,
  pairSchema,
  partialTrimSchema,
  TRIM_PIECES,
  type WallDef,
  windowSchema,
} from './sector.schema'

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

export const AF_SECTOR_FORMAT = 'af-sector/1'

/** The version a `format` member names, or nothing when it is not `af-sector/<major>` or `af-sector/<major>.<minor>`. */
const FORMAT = /^af-sector\/(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?$/

export function afFormatVersion(
  format: string,
): { readonly major: number; readonly minor: number } | undefined {
  const match = FORMAT.exec(format)
  if (!match) return undefined
  return { major: Number(match[1]), minor: Number(match[2] ?? 0) }
}

/** Major 1 opens (a newer minor with a warning, which the codec adds); any other major is refused. */
const formatSchema = z.string().superRefine((format, context) => {
  const version = afFormatVersion(format)
  if (version === undefined)
    context.addIssue({
      code: 'custom',
      message: `${format} is not af-sector/<major> or af-sector/<major>.<minor>`,
    })
  else if (version.major !== 1)
    context.addIssue({
      code: 'custom',
      message: `${format} is not a version this editor reads (${AF_SECTOR_FORMAT})`,
    })
})

/** One wall, as Last Light's, without the camera-zone members (`hideFrom`, `cut`): a file that carries them keeps them. */
export type AfWall = Omit<WallDef, 'hideFrom' | 'cut'>

export const afWallSchema: z.ZodType<AfWall> = z.looseObject({
  next: z.string().optional(),
  texture: z.string().optional(),
  trimTexture: z.partialRecord(z.enum(TRIM_PIECES), z.string()).optional(),
  trimDepth: z.partialRecord(z.enum(TRIM_PIECES), z.number()).optional(),
  pan: pairSchema.optional(),
  trim: partialTrimSchema.optional(),
  frame: z.boolean().optional(),
  mask: z.enum(['glass', 'bars']).optional(),
  block: z.boolean().optional(),
  maskTop: z.number().optional(),
  hatch: pairSchema.optional(),
  handrail: z.number().optional(),
  window: windowSchema.optional(),
  door: doorSchema.optional(),
  pilaster: z.looseObject({ start: pairSchema.optional(), end: pairSchema.optional() }).optional(),
  thick: z.number().optional(),
  occlude: z.enum(OCCLUDES).optional(),
})

/** A corner starts the wall that runs from it to the next corner. */
export type AfCorner = readonly [number, number, (AfWall | undefined)?]

const cornerSchema: z.ZodType<AfCorner> = z.tuple([z.number(), z.number(), afWallSchema.optional()])

/** An entry of the picker's list: the texture id is its key in the `materials` table. */
export interface AfMaterial {
  readonly category: string
  readonly label?: string | undefined
  readonly wallOnly?: boolean | undefined
}

export const afMaterialSchema: z.ZodType<AfMaterial> = z.looseObject({
  category: z.string(),
  label: z.string().optional(),
  wallOnly: z.boolean().optional(),
})

export interface AfSectorEntry {
  readonly id: string
  readonly floor: number
  readonly ceiling: number
  /** Shade, Build-style: 1 is normal, lower is darker. */
  readonly light: number
  /** Ceiling cut away for the overhead view. */
  readonly open?: boolean | undefined
  /** A name in the `styles` table, under the sector's own texture and trim members. */
  readonly style?: string | undefined
  readonly floorTexture?: string | undefined
  readonly ceilingTexture?: string | undefined
  readonly wallTexture?: string | undefined
  readonly trim?: PartialTrim | undefined
  /** The id of the camera view the game takes while the player is in this sector (a `camera-view` of the game's content). */
  readonly view?: string | undefined
  readonly corners: readonly AfCorner[]
  readonly holes?: readonly (readonly AfCorner[])[] | undefined
}

export const afSectorEntrySchema: z.ZodType<AfSectorEntry> = z.looseObject({
  id: z.string(),
  floor: z.number(),
  ceiling: z.number(),
  light: z.number(),
  open: z.boolean().optional(),
  style: z.string().optional(),
  floorTexture: z.string().optional(),
  ceilingTexture: z.string().optional(),
  wallTexture: z.string().optional(),
  trim: partialTrimSchema.optional(),
  view: z.string().optional(),
  corners: z.array(cornerSchema).min(3),
  holes: z.array(z.array(cornerSchema).min(3)).optional(),
})

/** An entity definition, carried as written until the typed model (ED3D.1b2) reads its fields. */
export interface AfEntityDef {
  readonly id: string
  readonly [member: string]: unknown
}

export const afEntityDefSchema: z.ZodType<AfEntityDef> = z.looseObject({ id: z.string() })

/** An instance of a definition: ids are unique across the file, so the codec can match them by `id`. */
export interface AfEntity {
  readonly def: string
  readonly id: string
  readonly x: number
  readonly z: number
  readonly y?: number | undefined
  readonly [member: string]: unknown
}

export const afEntitySchema: z.ZodType<AfEntity> = z.looseObject({
  def: z.string(),
  id: z.string(),
  x: z.number(),
  z: z.number(),
  y: z.number().optional(),
})

export interface AfSector {
  readonly format: string
  readonly name: string
  readonly materials?: Readonly<Record<string, AfMaterial>> | undefined
  readonly styles?: Readonly<Record<string, Style>> | undefined
  readonly sectors: readonly AfSectorEntry[]
  readonly entityDefs?: readonly AfEntityDef[] | undefined
  readonly entities?: readonly AfEntity[] | undefined
}

export const afSectorSchema: z.ZodType<AfSector> = z.looseObject({
  format: formatSchema,
  name: z.string(),
  materials: z.record(z.string(), afMaterialSchema).optional(),
  styles: z.record(z.string(), styleSchema).optional(),
  sectors: z.array(afSectorEntrySchema),
  entityDefs: z.array(afEntityDefSchema).optional(),
  entities: z.array(afEntitySchema).optional(),
})
