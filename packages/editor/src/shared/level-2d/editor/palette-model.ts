import { tileDraw } from '../canvas/draw/tile-draw'
import { packTile } from '../model/cells-codec'
import type { Project, Size, TilesetDef } from '../model/project-types'
import { tilesetTiles } from '../model/tileset-grid'
import type { LevelEditorView } from './level-editor'

// What the palette offers for the selected layer: a tiles, auto or
// objects layer paints its tileset's tiles (on an auto layer the brush stamps an override), an IntGrid layer its
// values, an entities layer places its definitions. A tile is cut out of the tileset image once the image is loaded,
// and is otherwise the numbered flat placeholder the canvas draws, so the two always agree.

/** Where a tile sits in its tileset image, for a CSS sprite. */
export interface TileImage {
  readonly path: string
  readonly size: Size
  readonly frame: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
}

export type PaletteItem =
  | {
      readonly kind: 'tile'
      readonly word: number
      readonly tile: number
      readonly label: string
      readonly color: string
      readonly image: TileImage | undefined
    }
  | { readonly kind: 'value'; readonly word: number; readonly label: string; readonly color: string }
  | {
      readonly kind: 'entity'
      readonly word: number
      readonly def: string
      readonly label: string
      readonly color: string
    }

export interface Palette {
  readonly items: readonly PaletteItem[]
}

/** The colour of a definition that has none of its own (the canvas's neutral). */
const NEUTRAL = '#8e8c85'

export type TileItem = Extract<PaletteItem, { readonly kind: 'tile' }>

/** Every tile of a tileset in index order, as the palette and the Tilesets view show them. */
export function tileItems(tileset: TilesetDef | undefined, images: ReadonlySet<string>): TileItem[] {
  if (tileset === undefined) return []
  const { count } = tilesetTiles(tileset)
  return Array.from({ length: count }, (_, tile) => {
    const drawn = tileDraw(
      tileset,
      images,
      { tile, flipX: false, flipY: false },
      { x: 0, y: 0, ...tileset.tile },
    )
    return {
      kind: 'tile',
      word: packTile(tile, false, false),
      tile,
      label: `Tile ${tile}`,
      color: drawn.kind === 'placeholder' ? drawn.color : NEUTRAL,
      image:
        drawn.kind === 'image'
          ? { path: drawn.image, size: tileset.imageSize, frame: drawn.frame }
          : undefined,
    }
  })
}

export function paletteOf(project: Project, layer: string, images: ReadonlySet<string>): Palette {
  const def = project.defs.layers.find((each) => each.id === layer)
  if (def === undefined) return { items: [] }
  if (def.kind === 'intgrid') {
    return {
      items: def.values.map((value) => ({
        kind: 'value',
        word: value.value,
        label: value.label ?? value.id,
        color: value.color,
      })),
    }
  }
  if (def.kind === 'entities') {
    return {
      items: project.defs.entities.map((entity) => ({
        kind: 'entity',
        word: 0,
        def: entity.id,
        label: entity.label ?? entity.id,
        color: entity.color ?? NEUTRAL,
      })),
    }
  }
  return {
    items: tileItems(
      project.defs.tilesets.find((set) => set.id === def.tileset),
      images,
    ),
  }
}

export function isChosen(item: PaletteItem, view: Pick<LevelEditorView, 'word' | 'entityDef'>): boolean {
  return item.kind === 'entity' ? item.def === view.entityDef : item.word === view.word
}
