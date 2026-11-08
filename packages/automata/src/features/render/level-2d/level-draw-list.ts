import {
  autoStacks,
  type ContentAnimation,
  type ContentEntityDef,
  type ContentLevel,
  type ContentProject,
  type ContentTileset,
  objectsOf,
  pictureOf,
  placeholderColor,
  tileFrame,
  tileRows,
} from '@automata/content/level-2d'

// A level as a flat list of things to draw, back to front, in level pixels. Pure: it knows nothing of Pixi, so what a
// game shows of a level is tested in Node. It follows the editor's own list (`level-draw-list.ts` in the editor), which
// reads the same rules from `@automata/content/level-2d`, so a level looks alike in both places.

/** A rectangle in a tileset's picture. */
export interface PictureFrame {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** One thing to draw: a tile cut from a loaded picture, a flat shape (a placeholder tile or a plain character), or an animated character. */
export type DrawItem =
  | AnimatedItem
  | {
      readonly kind: 'tile'
      readonly image: string
      readonly frame: PictureFrame
      readonly x: number
      readonly y: number
      readonly w: number
      readonly h: number
      readonly flipX: boolean
      readonly flipY: boolean
      readonly itemId?: string | undefined
    }
  | {
      readonly kind: 'flat'
      readonly color: string
      readonly x: number
      readonly y: number
      readonly w: number
      readonly h: number
      readonly ellipse: boolean
      readonly itemId?: string | undefined
    }

/** A placed character with clips: drawn playing its first clip once its picture is loaded. */
export interface AnimatedItem {
  readonly kind: 'animation'
  readonly animation: ContentAnimation
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly itemId?: string | undefined
}

/** What a level shows: its backdrop, its things back to front, and the sentences for anything that fell back. */
export interface LevelDraw {
  readonly background: {
    readonly color: string
    readonly image?: string | undefined
    readonly mode: ContentLevel['background']['mode']
  }
  readonly items: readonly DrawItem[]
  /** Each in the words of the thing a person made, once ("The level "Cave" uses tile 70, but …"). */
  readonly problems: readonly string[]
}

interface Box {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

type Cell = { readonly tile: number; readonly flipX: boolean; readonly flipY: boolean }

/** Builds one level's list. `images` holds the picture paths the game has; `live` the characters the game draws itself. */
export function levelDrawList(
  project: ContentProject,
  level: ContentLevel,
  images: ReadonlySet<string>,
  live: readonly string[],
): LevelDraw {
  const problems = new Set<string>()
  const items: DrawItem[] = []
  const tilesets = new Map(project.tilesets.map((tileset) => [tileset.id, tileset]))
  const defs = new Map(project.entities.map((def) => [def.id, def]))

  /** The picture of `tile` in `tilesetId` drawn into `box`; a flat placeholder when there is no picture to cut. */
  function tileItem(tilesetId: string, cell: Cell, box: Box, itemId?: string): DrawItem {
    const placeholder: DrawItem = {
      kind: 'flat',
      color: placeholderColor(cell.tile),
      ...box,
      ellipse: false,
      itemId,
    }
    const tileset: ContentTileset | undefined = tilesets.get(tilesetId)
    if (tileset === undefined) {
      problems.add(`The level "${level.name}" uses the tileset "${tilesetId}", which is not in the project.`)
      return placeholder
    }
    const frame = tileFrame(tileset, cell.tile)
    if (frame === undefined) {
      problems.add(
        `The level "${level.name}" uses tile ${cell.tile}, but "${tileset.id}" has ${tileset.columns * tileset.rows} tiles.`,
      )
      return placeholder
    }
    if (tileset.image === undefined) return placeholder
    if (!images.has(tileset.image)) {
      problems.add(`The level "${level.name}" uses the picture "${tileset.image}", which is not in the game.`)
      return placeholder
    }
    return { kind: 'tile', image: tileset.image, frame, ...box, flipX: cell.flipX, flipY: cell.flipY, itemId }
  }

  function cellsInto(
    grids: readonly (readonly (readonly (Cell | undefined)[])[])[],
    tilesetId: string,
    grid: number,
  ): void {
    for (const rows of grids)
      for (const [ry, row] of rows.entries())
        for (const [rx, cell] of row.entries())
          if (cell !== undefined)
            items.push(tileItem(tilesetId, cell, { x: rx * grid, y: ry * grid, w: grid, h: grid }))
  }

  function entityBox(
    def: ContentEntityDef,
    item: { x: number; y: number; w?: number | undefined; h?: number | undefined },
  ): Box {
    const w = item.w ?? def.size.w
    const h = item.h ?? def.size.h
    return { x: item.x - def.pivot.x * w, y: item.y - def.pivot.y * h, w, h }
  }

  // The project lists layers front to back, as the editor's panel shows them; painting goes back to front.
  for (const def of [...project.layers].reverse()) {
    const layer = level.layers.find((candidate) => candidate.def === def.id)
    if (layer === undefined) continue
    if (def.kind === 'tiles' && layer.kind === 'tiles')
      cellsInto([tileRows(level, def.id)], def.tileset, def.grid)
    else if (def.kind === 'auto' && layer.kind === 'auto')
      cellsInto(autoStacks(level, def.id), def.tileset, def.grid)
    else if (def.kind === 'objects' && layer.kind === 'objects') {
      const size = tilesets.get(def.tileset)?.tile ?? { w: 1, h: 1 }
      for (const object of objectsOf(level, def.id))
        items.push(tileItem(def.tileset, object, { x: object.x, y: object.y, w: size.w, h: size.h }))
    } else if (def.kind === 'entities' && layer.kind === 'entities') {
      for (const item of layer.items) {
        const entity = defs.get(item.def)
        if (entity === undefined || live.includes(entity.id)) continue
        const box = entityBox(entity, item)
        const picture = pictureOf(entity)
        // Frames play in the game; until the picture has arrived the character shows the look it has without one.
        const still = picture.kind === 'clip' ? picture.still : picture
        if (picture.kind === 'clip' && entity.animation !== undefined && images.has(picture.image))
          items.push({ kind: 'animation', animation: entity.animation, ...box, itemId: item.id })
        else if (picture.kind === 'clip' && still.kind === 'flat') {
          problems.add(
            `The level "${level.name}" uses the picture "${picture.image}", which is not in the game.`,
          )
          items.push({
            kind: 'flat',
            color: still.color,
            ...box,
            ellipse: still.shape === 'ellipse',
            itemId: item.id,
          })
        } else if (still.kind === 'tile')
          items.push(tileItem(still.tileset, { tile: still.index, flipX: false, flipY: false }, box, item.id))
        else if (still.shape === 'point') {
          // The editor marks a point with a small dot at its pivot; a play field shows the same.
          items.push({
            kind: 'flat',
            color: still.color,
            x: item.x - 3,
            y: item.y - 3,
            w: 6,
            h: 6,
            ellipse: true,
            itemId: item.id,
          })
        } else
          items.push({
            kind: 'flat',
            color: still.color,
            ...box,
            ellipse: still.shape === 'ellipse',
            itemId: item.id,
          })
      }
    }
    // IntGrid layers are the game's rules (walls, water), shown through the auto layers built on them.
  }

  let background = level.background
  if (background.image !== undefined && !images.has(background.image)) {
    problems.add(
      `The level "${level.name}" uses the picture "${background.image}", which is not in the game.`,
    )
    background = { color: background.color, mode: background.mode }
  }
  return { background, items, problems: [...problems] }
}
