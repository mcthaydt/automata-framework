import type { LevelEditorView } from '../../app/level-editor'
import type { Bounds } from '../../model/commands/entity-geometry'
import type { Background, EntityShape, Project, Size } from '../../model/project-types'
import type { Point } from '../../tiles/footprint'

// What the level canvas draws (ED2D.4c3a, 2D editor spec §8): plain data, positions in level pixels, colours as the
// project holds them (`#rrggbb` or a kit token name, which the renderer resolves). The Pixi canvas of ED2D.4c3b turns
// each item into a sprite or a rectangle and decides nothing else.

/**
 * Why a tile is drawn as a numbered placeholder (spec §13, ED2D-D11): its set has no image yet, its image is not
 * loaded (not imported, missing or corrupt), its index is beyond the set, or its layer names a tileset that is gone.
 */
export type PlaceholderReason = 'placeholder' | 'missing' | 'outOfRange' | 'noTileset'

interface TilePlacement extends Bounds {
  readonly tile: number
  readonly flipX: boolean
  readonly flipY: boolean
}

/** One tile at a place: a frame of a loaded image, or a flat placeholder labelled with the tile's index. */
export type TileDraw = TilePlacement &
  (
    | { readonly kind: 'image'; readonly image: string; readonly frame: Bounds }
    | {
        readonly kind: 'placeholder'
        readonly reason: PlaceholderReason
        /** `#rrggbb`, fixed by the tile index. */
        readonly color: string
        readonly label: string
      }
  )

/** The tiles of one 16 × 16-cell chunk of a tiles or auto layer; an auto cell may hold several, in rule order. */
export interface TileChunk {
  readonly cx: number
  readonly cy: number
  readonly bounds: Bounds
  readonly tiles: readonly TileDraw[]
}

export interface IntCellDraw extends Bounds {
  readonly value: number
  /** The value's colour; `undefined` for a value the layer does not define (Checks report it). */
  readonly color: string | undefined
}

export interface IntChunk {
  readonly cx: number
  readonly cy: number
  readonly bounds: Bounds
  readonly cells: readonly IntCellDraw[]
}

/** An entity instance: its box (`entityBounds`), its pivot point and how its definition says to draw it. */
export interface EntityDraw extends Bounds {
  readonly id: string
  readonly def: string
  readonly shape: EntityShape
  readonly pivot: Point
  readonly color: string | undefined
  readonly label: string
  /** For a `tile` shape with a tile: the tile drawn in the box. */
  readonly tile: TileDraw | undefined
}

export type ObjectDraw = TileDraw & { readonly id: string }

interface LayerCommon {
  readonly def: string
  readonly opacity: number
  /** Drawn, but the pointer does nothing on it. */
  readonly locked: boolean
}

export type LayerDraw =
  | (LayerCommon & { readonly kind: 'tiles' | 'auto'; readonly chunks: readonly TileChunk[] })
  | (LayerCommon & { readonly kind: 'intgrid'; readonly chunks: readonly IntChunk[] })
  | (LayerCommon & { readonly kind: 'entities'; readonly entities: readonly EntityDraw[] })
  | (LayerCommon & { readonly kind: 'objects'; readonly objects: readonly ObjectDraw[] })

/** The active layer's grid: line positions in level pixels, from 0 to the level's edge. */
export interface GridLines {
  readonly step: number
  readonly xs: readonly number[]
  readonly ys: readonly number[]
}

/** The cells the next pointer down would edit, as one rectangle in level pixels. */
export interface Footprint extends Bounds {
  readonly erase: boolean
}

/** A link from an instance of the level (plan ED2D.6c decision 4): a chip naming the target at the source's anchor. */
export interface LinkDraw {
  /** The source instance. */
  readonly id: string
  readonly field: string
  readonly from: Point
  readonly label: string
  /** The source definition's colour. */
  readonly color: string | undefined
  readonly selected: boolean
  /** The target's anchor when it is in this level, for a line to it. */
  readonly to: Point | undefined
}

export interface LevelDrawList {
  readonly level: string
  readonly size: Size
  /** The level's background; `image` only when it is loaded. */
  readonly background: Background
  /** Visible layers, back to front (the reverse of `defs.layers`). */
  readonly layers: readonly LayerDraw[]
  readonly grid: GridLines | undefined
  readonly footprint: Footprint | undefined
  readonly selection: readonly (Bounds & { readonly id: string })[]
  readonly links: readonly LinkDraw[]
}

/** What the canvas reads of the Level view controller's state (ED2D.4b owns it). */
export type DrawView = Pick<
  LevelEditorView,
  'level' | 'layer' | 'tool' | 'brushSize' | 'hover' | 'rectangle' | 'selected' | 'hidden' | 'locked'
>

export interface LevelDrawInput {
  readonly project: Project
  readonly view: DrawView
  /** The image paths the texture manager has loaded; a tileset whose image is not here draws placeholders. */
  readonly images: ReadonlySet<string>
  /**
   * Each loaded image's generation (the texture manager's `generations`): an image loaded again after it was forgotten
   * has a new one, so the chunks drawn from the old texture are drawn again. Absent, every loaded image counts as one.
   */
  readonly generations?: ReadonlyMap<string, number> | undefined
}
