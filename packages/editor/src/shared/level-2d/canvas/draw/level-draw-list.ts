// Turns a level and its project into a flat list of things to draw, in order. It reads the model and knows nothing
// about Pixi, so what is drawn can be tested without a canvas.
import { pictureOf } from '@automata/content/level-2d'
import { entityBounds, entityDefOf } from '../../model/commands/entity-geometry'
import type {
  Background,
  EntitiesLayerInstance,
  LayerDef,
  LayerInstance,
  Level,
  ObjectsLayerInstance,
  Project,
  TilesetDef,
} from '../../model/project-types'
import { createCellChunks } from './cell-chunks'
import type {
  ClipDraw,
  EntityDraw,
  LayerDraw,
  LevelDrawInput,
  LevelDrawList,
  ObjectDraw,
} from './draw-list-types'
import { footprint, gridLines, linkChips, selectionBoxes } from './overlays'
import { tileDraw } from './tile-draw'

// The level canvas as data: from the project, the Level view's state and the images the
// texture manager holds, everything the Pixi canvas draws, back to front, in level pixels. Pure: no Pixi, DOM or clock
// (`architecture.test.ts` holds `canvas/draw/` to the headless core's rules), so it is tested in Node.

function findLevel(project: Project, id: string): Level {
  const level = project.levels.find((candidate) => candidate.id === id)
  if (level === undefined) throw new RangeError(`no level "${id}"`)
  return level
}

function backgroundOf(background: Background, images: ReadonlySet<string>): Background {
  if (background.image === undefined || images.has(background.image)) return background
  const { image: _missing, ...shown } = background
  return shown
}

const tilesetOf = (project: Project, id: string): TilesetDef | undefined =>
  project.defs.tilesets.find((candidate) => candidate.id === id)

/**
 * The instances of an entities layer as their definitions draw them, in the layer's order (the last is on top). An
 * instance whose definition is gone is left out, as `entityAt` leaves it out; the Checks report it.
 */
function entitiesOf(
  project: Project,
  layer: EntitiesLayerInstance,
  images: ReadonlySet<string>,
): EntityDraw[] {
  return layer.items.flatMap((item) => {
    const def = entityDefOf(project, item.def)
    if (def === undefined) return []
    const box = entityBounds(def, item)
    // The editor and the game ask the same question (`pictureOf`): a clip's first frame, a tile, or a flat shape. The game
    // plays the clip; the editor holds the first frame, and shows the still look until the picture is loaded.
    const picture = pictureOf(def)
    const clip: ClipDraw | undefined =
      picture.kind === 'clip' && images.has(picture.image)
        ? { image: picture.image, cell: picture.cell, index: picture.index }
        : undefined
    const still = picture.kind === 'clip' ? picture.still : picture
    const tile =
      clip === undefined && still.kind === 'tile'
        ? tileDraw(
            tilesetOf(project, still.tileset),
            images,
            { tile: still.index, flipX: false, flipY: false },
            box,
          )
        : undefined
    return [
      {
        id: item.id,
        def: def.id,
        shape: def.shape,
        ...box,
        pivot: { x: item.x, y: item.y },
        color: def.color,
        label: def.label ?? def.id,
        tile,
        clip,
      },
    ]
  })
}

/**
 * Objects at their tileset's tile size, top-left at their position. A layer naming a tileset that is gone cannot be
 * opened (the codec reports `unknownTileset`), so the 1 px placeholder it would get only keeps the list from throwing.
 */
function objectsOf(
  tileset: TilesetDef | undefined,
  layer: ObjectsLayerInstance,
  images: ReadonlySet<string>,
): ObjectDraw[] {
  const size = tileset?.tile ?? { w: 1, h: 1 }
  return layer.items.map((item) => ({
    id: item.id,
    ...tileDraw(tileset, images, item, { x: item.x, y: item.y, w: size.w, h: size.h }),
  }))
}

/** One drawer per canvas: it keeps the chunks it drew last, so an unchanged chunk comes back as the same object. */
export function createLevelDrawList(): (input: LevelDrawInput) => LevelDrawList {
  const chunks = createCellChunks()

  function layerDraw(
    project: Project,
    level: Level,
    def: LayerDef,
    layer: LayerInstance,
    input: LevelDrawInput,
  ): LayerDraw | undefined {
    const { images } = input
    const locked = input.view.locked.has(def.id)
    if (def.kind === 'tiles' && layer.kind === 'tiles') {
      const tiles = chunks.tiles(def, layer.cells, tilesetOf(project, def.tileset), images, input.generations)
      return { kind: 'tiles', def: def.id, opacity: def.opacity, locked, chunks: tiles }
    }
    if (def.kind === 'intgrid' && layer.kind === 'intgrid') {
      return {
        kind: 'intgrid',
        def: def.id,
        opacity: def.opacity,
        locked,
        chunks: chunks.intgrid(def, layer.cells),
      }
    }
    if (def.kind === 'auto' && layer.kind === 'auto') {
      const source = level.layers.find((candidate) => candidate.def === def.source)
      const cells = source?.kind === 'intgrid' ? source.cells : undefined
      const tiles = chunks.auto(def, layer, cells, tilesetOf(project, def.tileset), images, input.generations)
      return { kind: 'auto', def: def.id, opacity: def.opacity, locked, chunks: tiles }
    }
    if (def.kind === 'entities' && layer.kind === 'entities') {
      return {
        kind: 'entities',
        def: def.id,
        opacity: 1,
        locked,
        entities: entitiesOf(project, layer, images),
      }
    }
    if (def.kind === 'objects' && layer.kind === 'objects') {
      const objects = objectsOf(tilesetOf(project, def.tileset), layer, images)
      return { kind: 'objects', def: def.id, opacity: 1, locked, objects }
    }
    // A layer whose kind disagrees with its definition cannot be opened (the codec refuses it), so it is not drawn.
    return undefined
  }

  return (input) => {
    const { project, view } = input
    const level = findLevel(project, view.level)
    const layers: LayerDraw[] = []
    // Definitions run front to back as the panel shows them; painting goes back to front.
    for (const def of [...project.defs.layers].reverse()) {
      if (view.hidden.has(def.id)) continue
      const layer = level.layers.find((candidate) => candidate.def === def.id)
      const drawn = layer === undefined ? undefined : layerDraw(project, level, def, layer, input)
      if (drawn !== undefined) layers.push(drawn)
    }
    const active = project.defs.layers.find((def) => def.id === view.layer)
    return {
      level: level.id,
      size: level.size,
      background: backgroundOf(level.background, input.images),
      layers,
      grid: active === undefined ? undefined : gridLines(active, level.size),
      footprint: active === undefined ? undefined : footprint(active, view, level.size),
      selection: selectionBoxes(project, level, view),
      links: linkChips(project, level, view),
    }
  }
}
