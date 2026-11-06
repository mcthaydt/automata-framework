import { z } from 'zod'
import type { EntityDef, FieldDef, FieldValues } from './field-types'
import { fieldDefSchema, fieldValuesSchema } from './fields.schema'

// The shape of the AF content export: what `project.toml`, `levels/<id>.toml` and `world.toml`
// hold once a reader has parsed the TOML. Strict, so a reader cannot come to depend on a key the editor does not
// promise; the export's test validates what it wrote against these. A game reads the files with any TOML parser and
// these schemas; it needs nothing else from the editor.

// -- types ----------------------------------------------------------------------------------------------------
// Written out, not inferred, so the package's declarations need no schema internals (`isolatedDeclarations`).
// Optional properties accept an explicit `undefined`, as the schemas' output types say.

/** A width and height in pixels. */
export interface ContentSize {
  readonly w: number
  readonly h: number
}

/** A layer definition in `project.toml`, by kind. */
export type ContentProjectLayer =
  | { readonly id: string; readonly kind: 'tiles'; readonly grid: number; readonly tileset: string }
  | {
      readonly id: string
      readonly kind: 'intgrid'
      readonly grid: number
      readonly values: readonly { readonly value: number; readonly id: string }[]
    }
  | {
      readonly id: string
      readonly kind: 'auto'
      readonly grid: number
      readonly source: string
      readonly tileset: string
    }
  | { readonly id: string; readonly kind: 'entities'; readonly grid: number; readonly snap: boolean }
  | { readonly id: string; readonly kind: 'objects'; readonly tileset: string; readonly snap: number }

/** A tileset in `project.toml`: its tile size, grid, optional image and tags. */
export interface ContentTileset {
  readonly id: string
  readonly tile: ContentSize
  readonly columns: number
  readonly rows: number
  readonly spacing: number
  readonly padding: number
  readonly image?: string | undefined
  readonly placeholder: boolean
  readonly tags: readonly { readonly tag: string; readonly tiles: readonly number[] }[]
}

/** An entity definition in `project.toml`: a typed-field definition plus how the editor draws and places it. */
export type ContentEntityDef = EntityDef & {
  readonly shape: 'rect' | 'ellipse' | 'point' | 'tile'
  readonly size: ContentSize
  readonly pivot: { readonly x: number; readonly y: number }
  readonly resizable: 'none' | 'x' | 'y' | 'xy'
  readonly tile?: { readonly tileset: string; readonly index: number } | undefined
  readonly tags: readonly string[]
  readonly min?: { readonly per: 'level' | 'project'; readonly count: number } | undefined
}

/** The project as `project.toml` holds it: the layer, tileset and entity definitions every level uses. */
export interface ContentProject {
  readonly format: 'af2d-content'
  readonly version: 1
  readonly name: string
  readonly template: string
  readonly layers: readonly ContentProjectLayer[]
  readonly tilesets: readonly ContentTileset[]
  readonly entities: readonly ContentEntityDef[]
  readonly levelFields: readonly FieldDef[]
}

/** One stack entry of an auto layer: run-length row strings. */
export interface ContentRows {
  readonly rows: readonly string[]
}

/** One placed entity in a level: its definition, its position (and size when resizable) and its field values. */
export interface ContentEntityItem {
  readonly id: string
  readonly def: string
  readonly x: number
  readonly y: number
  readonly w?: number | undefined
  readonly h?: number | undefined
  readonly fields: FieldValues
}

/** One placed tile object in an objects layer. */
export interface ContentObjectItem {
  readonly id: string
  readonly tile: number
  readonly x: number
  readonly y: number
  readonly flipX: boolean
  readonly flipY: boolean
}

/** One layer of a level, by kind: tile rows, IntGrid rows, auto-tile stacks, entities or objects. */
export type ContentLevelLayer =
  | { readonly def: string; readonly kind: 'tiles'; readonly rows: readonly string[] }
  | { readonly def: string; readonly kind: 'intgrid'; readonly rows: readonly string[] }
  | { readonly def: string; readonly kind: 'auto'; readonly stack: readonly ContentRows[] }
  | { readonly def: string; readonly kind: 'entities'; readonly items: readonly ContentEntityItem[] }
  | { readonly def: string; readonly kind: 'objects'; readonly items: readonly ContentObjectItem[] }

/** A level as `levels/<id>.toml` holds it, after parsing the TOML. */
export interface ContentLevel {
  readonly format: 'af2d-content'
  readonly version: 1
  readonly id: string
  readonly name: string
  readonly size: ContentSize
  readonly background: {
    readonly color: string
    readonly image?: string | undefined
    readonly mode: 'fit' | 'cover' | 'repeat' | 'repeat-x'
  }
  readonly fields: FieldValues
  readonly layers: readonly ContentLevelLayer[]
}

/** One level's neighbours in `world.toml`, each side ordered by position and then id. The editor computes them. */
export interface ContentNeighbours {
  readonly level: string
  readonly north: readonly string[]
  readonly east: readonly string[]
  readonly south: readonly string[]
  readonly west: readonly string[]
}

/** The worlds as `world.toml` holds them: layout, level placements and, for a grid world, each level's neighbours. */
export interface ContentWorld {
  readonly format: 'af2d-content'
  readonly version: 1
  readonly worlds: readonly {
    readonly id: string
    readonly layout: 'free' | 'grid' | 'horizontal' | 'vertical'
    readonly grid?: ContentSize | undefined
    readonly placements: readonly {
      readonly level: string
      readonly x: number
      readonly y: number
      readonly depth: number
    }[]
    /** Only in a `grid` world: for each level, the levels whose edge touches its own along a span of positive length. */
    readonly neighbours?: readonly ContentNeighbours[] | undefined
  }[]
}

// -- schemas --------------------------------------------------------------------------------------------------

const header = { format: z.literal('af2d-content'), version: z.literal(1) }
const size = z.strictObject({ w: z.number(), h: z.number() })
const nonNegativeInt = z.number().int().min(0)
/** Row strings in the working file's cell format (`cells-codec.ts`): one string per row, run-length coded. */
const rows = z.array(z.string())

// -- project.toml ---------------------------------------------------------------------------------------------

const projectLayer = z.discriminatedUnion('kind', [
  z.strictObject({ id: z.string(), kind: z.literal('tiles'), grid: nonNegativeInt, tileset: z.string() }),
  z.strictObject({
    id: z.string(),
    kind: z.literal('intgrid'),
    grid: nonNegativeInt,
    values: z.array(z.strictObject({ value: nonNegativeInt, id: z.string() })),
  }),
  z.strictObject({
    id: z.string(),
    kind: z.literal('auto'),
    grid: nonNegativeInt,
    source: z.string(),
    tileset: z.string(),
  }),
  z.strictObject({ id: z.string(), kind: z.literal('entities'), grid: nonNegativeInt, snap: z.boolean() }),
  z.strictObject({ id: z.string(), kind: z.literal('objects'), tileset: z.string(), snap: nonNegativeInt }),
])

const projectTileset = z.strictObject({
  id: z.string(),
  tile: size,
  columns: nonNegativeInt,
  rows: nonNegativeInt,
  spacing: nonNegativeInt,
  padding: nonNegativeInt,
  /** The image's workspace path; absent while the tileset is a placeholder. */
  image: z.string().optional(),
  placeholder: z.boolean(),
  tags: z.array(z.strictObject({ tag: z.string(), tiles: z.array(nonNegativeInt) })),
})

const projectEntity = z.strictObject({
  id: z.string(),
  label: z.string().optional(),
  color: z.string().optional(),
  single: z.boolean().optional(),
  fields: z.array(fieldDefSchema),
  shape: z.enum(['rect', 'ellipse', 'point', 'tile']),
  size,
  pivot: z.strictObject({ x: z.number(), y: z.number() }),
  resizable: z.enum(['none', 'x', 'y', 'xy']),
  tile: z.strictObject({ tileset: z.string(), index: nonNegativeInt }).optional(),
  tags: z.array(z.string()),
  min: z.strictObject({ per: z.enum(['level', 'project']), count: nonNegativeInt }).optional(),
})

const projectContent = z.strictObject({
  ...header,
  name: z.string(),
  template: z.string(),
  layers: z.array(projectLayer),
  tilesets: z.array(projectTileset),
  entities: z.array(projectEntity),
  levelFields: z.array(fieldDefSchema),
})

// -- levels/<id>.toml -----------------------------------------------------------------------------------------

const levelLayer = z.discriminatedUnion('kind', [
  z.strictObject({ def: z.string(), kind: z.literal('tiles'), rows }),
  z.strictObject({ def: z.string(), kind: z.literal('intgrid'), rows }),
  /** The derived tiles with manual overrides applied: one grid per stack depth, depth 0 drawn first. */
  z.strictObject({ def: z.string(), kind: z.literal('auto'), stack: z.array(z.strictObject({ rows })) }),
  z.strictObject({
    def: z.string(),
    kind: z.literal('entities'),
    items: z.array(
      z.strictObject({
        id: z.string(),
        def: z.string(),
        x: z.number(),
        y: z.number(),
        w: z.number().optional(),
        h: z.number().optional(),
        fields: fieldValuesSchema,
      }),
    ),
  }),
  z.strictObject({
    def: z.string(),
    kind: z.literal('objects'),
    items: z.array(
      z.strictObject({
        id: z.string(),
        tile: nonNegativeInt,
        x: z.number(),
        y: z.number(),
        flipX: z.boolean(),
        flipY: z.boolean(),
      }),
    ),
  }),
])

const levelContent = z.strictObject({
  ...header,
  id: z.string(),
  name: z.string(),
  size,
  background: z.strictObject({
    color: z.string(),
    image: z.string().optional(),
    mode: z.enum(['fit', 'cover', 'repeat', 'repeat-x']),
  }),
  fields: fieldValuesSchema,
  layers: z.array(levelLayer),
})

// -- world.toml -----------------------------------------------------------------------------------------------

const worldContent = z.strictObject({
  ...header,
  worlds: z.array(
    z.strictObject({
      id: z.string(),
      layout: z.enum(['free', 'grid', 'horizontal', 'vertical']),
      grid: size.optional(),
      placements: z.array(
        z.strictObject({ level: z.string(), x: z.number(), y: z.number(), depth: z.number() }),
      ),
      /** Only in a `grid` world: for each level, the levels whose edge touches its own along a span of positive length. */
      neighbours: z
        .array(
          z.strictObject({
            level: z.string(),
            north: z.array(z.string()),
            east: z.array(z.string()),
            south: z.array(z.string()),
            west: z.array(z.string()),
          }),
        )
        .optional(),
    }),
  ),
})

/** The strict schema of `project.toml`. */
export const projectContentSchema: z.ZodType<ContentProject> = projectContent
/** The strict schema of `levels/<id>.toml`. */
export const levelContentSchema: z.ZodType<ContentLevel> = levelContent
/** The strict schema of `world.toml`. */
export const worldContentSchema: z.ZodType<ContentWorld> = worldContent
