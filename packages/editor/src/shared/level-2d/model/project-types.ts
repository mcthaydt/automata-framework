import type { ContentAnimation, EntityDef, FieldDef, FieldValues } from '@automata/content/level-2d'
import type { RuleGroup } from '../tiles/autotile/rule.schema.ts'
import type { Grid } from './grid.ts'

// The project model. One model, two shapes: `Project` holds grids as
// `Grid`, and `ProjectFile` is the same tree with each grid as its row strings, which is what `*.af2d.json` stores and
// what `project.schema.ts` validates. The only difference is a layer instance, so `Project` and `Level` take its type
// as a parameter instead of repeating every field.
//
// Optional properties accept an explicit `undefined` (`exactOptionalPropertyTypes` is on) so the zod schemas, whose
// output types say `T | undefined`, are assignable to these interfaces.

/** A pixel size. */
export interface Size {
  readonly w: number
  readonly h: number
}

export interface IntValueDef {
  /** 1 to 255; 0 is the empty cell. */
  readonly value: number
  readonly id: string
  readonly label?: string | undefined
  /** `#rrggbb`. */
  readonly color: string
}

export interface TilesLayerDef {
  readonly id: string
  readonly label: string
  readonly kind: 'tiles'
  /** Cell size in px. */
  readonly grid: number
  readonly tileset: string
  readonly opacity: number
}

export interface IntGridLayerDef {
  readonly id: string
  readonly label: string
  readonly kind: 'intgrid'
  readonly grid: number
  readonly values: readonly IntValueDef[]
  readonly opacity: number
}

export interface AutoLayerDef {
  readonly id: string
  readonly label: string
  readonly kind: 'auto'
  readonly grid: number
  /** The id of the IntGrid layer whose cells the rules read. */
  readonly source: string
  readonly tileset: string
  readonly groups: readonly RuleGroup[]
  readonly opacity: number
}

export interface EntitiesLayerDef {
  readonly id: string
  readonly label: string
  readonly kind: 'entities'
  readonly grid: number
  /** Whether placing and dragging snaps to the grid. */
  readonly snap: boolean
}

export interface ObjectsLayerDef {
  readonly id: string
  readonly label: string
  readonly kind: 'objects'
  readonly tileset: string
  /** Snap in px; 0 is free placement. */
  readonly snap: number
}

export type LayerDef = TilesLayerDef | IntGridLayerDef | AutoLayerDef | EntitiesLayerDef | ObjectsLayerDef

export interface TilesetDef {
  readonly id: string
  readonly label: string
  /** An asset path in the workspace. Absent: a placeholder set, which keeps every tile index when art replaces it. */
  readonly image?: string | undefined
  /** Recorded when the image is imported; columns and rows derive from it. */
  readonly imageSize: Size
  readonly tile: Size
  readonly spacing: number
  readonly padding: number
  /** "solid", "water", … for palettes and rules. */
  readonly tags: readonly { readonly tag: string; readonly tiles: readonly number[] }[]
}

export type EntityShape = 'rect' | 'ellipse' | 'point' | 'tile'
export type EntityResize = 'none' | 'x' | 'y' | 'xy'

/** The kit's entity definition (id, label, color, single, fields) plus what the canvas needs to draw and place it. */
export type EntityDef2D = EntityDef & {
  readonly shape: EntityShape
  readonly size: Size
  /** 0 to 1 within the shape. */
  readonly pivot: { readonly x: number; readonly y: number }
  readonly resizable: EntityResize
  /** Drawn on the canvas when set. */
  readonly tile?: { readonly tileset: string; readonly index: number } | undefined
  /** A picture cut into frames and clips over them; a character with one plays its first clip until a game says otherwise. */
  readonly animation?: ContentAnimation | undefined
  readonly tags: readonly string[]
  /** "At least one player-start in the project": a count the Checks enforce, no template code. */
  readonly min?: { readonly per: 'level' | 'project'; readonly count: number } | undefined
}

export interface Definitions {
  /** Front to back, as the panel shows them. */
  readonly layers: readonly LayerDef[]
  readonly tilesets: readonly TilesetDef[]
  readonly entities: readonly EntityDef2D[]
  /** Typed fields every level carries. */
  readonly levelFields: readonly FieldDef[]
}

export type WorldLayout = 'free' | 'grid' | 'horizontal' | 'vertical'

export interface Placement {
  readonly level: string
  readonly x: number
  readonly y: number
  readonly depth: number
}

export interface World {
  readonly id: string
  readonly layout: WorldLayout
  /** Present exactly when the layout is `grid`: the snap size in px. */
  readonly grid?: Size | undefined
  readonly placements: readonly Placement[]
}

export type BackgroundMode = 'fit' | 'cover' | 'repeat' | 'repeat-x'

export interface Background {
  /** `#rrggbb`. */
  readonly color: string
  readonly image?: string | undefined
  readonly mode: BackgroundMode
}

export interface EntityInstance {
  readonly id: string
  readonly def: string
  readonly x: number
  readonly y: number
  /** Only when the definition is resizable. */
  readonly w?: number | undefined
  readonly h?: number | undefined
  readonly fields: FieldValues
}

export interface ObjectInstance {
  readonly id: string
  readonly tile: number
  readonly x: number
  readonly y: number
  readonly flipX: boolean
  readonly flipY: boolean
}

export interface TilesLayerInstance {
  readonly def: string
  readonly kind: 'tiles'
  /** Packed tile cells (`cells-codec.ts`). */
  readonly cells: Grid
}

export interface IntGridLayerInstance {
  readonly def: string
  readonly kind: 'intgrid'
  /** 0 is empty, else the value. */
  readonly cells: Grid
}

export interface AutoLayerInstance {
  readonly def: string
  readonly kind: 'auto'
  /** Mixed into the variation hash; "re-roll" changes it. The output is derived, never stored. */
  readonly seed: number
  /** Manual tiles painted over the derived output. */
  readonly overrides: Grid
}

export interface EntitiesLayerInstance {
  readonly def: string
  readonly kind: 'entities'
  readonly items: readonly EntityInstance[]
}

export interface ObjectsLayerInstance {
  readonly def: string
  readonly kind: 'objects'
  readonly items: readonly ObjectInstance[]
}

export type LayerInstance =
  | TilesLayerInstance
  | IntGridLayerInstance
  | AutoLayerInstance
  | EntitiesLayerInstance
  | ObjectsLayerInstance

/** A grid as the file stores it: one run-length row string per row. */
export type RowStrings = readonly string[]

export interface TilesLayerFile {
  readonly def: string
  readonly kind: 'tiles'
  readonly rows: RowStrings
}

export interface IntGridLayerFile {
  readonly def: string
  readonly kind: 'intgrid'
  readonly rows: RowStrings
}

export interface AutoLayerFile {
  readonly def: string
  readonly kind: 'auto'
  readonly seed: number
  readonly overrides: RowStrings
}

export type LayerInstanceFile =
  | TilesLayerFile
  | IntGridLayerFile
  | AutoLayerFile
  | EntitiesLayerInstance
  | ObjectsLayerInstance

export interface Level<Layer = LayerInstance> {
  /** `/^[a-z][a-z0-9-]*$/`, unique in the project. */
  readonly id: string
  readonly name: string
  /** px. */
  readonly size: Size
  readonly background: Background
  /** Values of `defs.levelFields`. */
  readonly fields: FieldValues
  /** One per layer definition, in the definitions' order. */
  readonly layers: readonly Layer[]
}

export interface Project<Layer = LayerInstance> {
  readonly format: 'af2d'
  /** Bumped by a migration, never edited in place. */
  readonly version: 1
  readonly name: string
  /** Where it started; informs nothing at runtime. */
  readonly template: string
  readonly defs: Definitions
  /** At least one. */
  readonly worlds: readonly World[]
  /** Each level is placed in exactly one world. */
  readonly levels: readonly Level<Layer>[]
}

/** The file shape of a project: what `project.schema.ts` validates and `project.codec.ts` reads and prints. */
export type ProjectFile = Project<LayerInstanceFile>
