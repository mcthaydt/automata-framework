import { Container, Graphics, Sprite, Text, type Texture, TilingSprite } from 'pixi.js'
import type { Background, Size } from '../model/project-types'
import type { ColorResolver } from './colors'
import type {
  EntityDraw,
  IntChunk,
  LevelDrawList,
  ObjectDraw,
  TileChunk,
  TileDraw,
} from './draw/draw-list-types'
import type { TextureManager } from './textures.manager'

// The Pixi objects for each item of a draw list (ED2D.4c3b). Every function here only turns data into display
// objects; which ones to keep from one update to the next is `level-scene.ts`'s business. Positions are level pixels;
// `px` is the size of one screen pixel in level pixels (1 / the camera's scale), so lines and labels stay thin and
// legible at any zoom.

export interface ItemContext {
  readonly textures: TextureManager
  readonly colors: ColorResolver
}

/** The texture a tile shows: its frame of the loaded image, or its numbered placeholder. */
function tileTexture(tile: TileDraw, context: ItemContext): Texture {
  if (tile.kind === 'image') {
    const frame = context.textures.frame(tile.image, tile.frame)
    // The draw list said the image is loaded; if it has since been forgotten, the honest fallback is a placeholder.
    if (frame !== undefined) return frame
  }
  const color = tile.kind === 'placeholder' ? tile.color : '#000000'
  return context.textures.placeholder(String(tile.tile), color, { w: tile.w, h: tile.h })
}

/** A tile as a sprite filling its cell; a flip mirrors it about the cell's centre. */
export function tileSprite(tile: TileDraw, context: ItemContext): Sprite {
  const texture = tileTexture(tile, context)
  const sprite = new Sprite(texture)
  sprite.anchor.set(0.5)
  sprite.position.set(tile.x + tile.w / 2, tile.y + tile.h / 2)
  sprite.scale.set(
    ((tile.flipX ? -1 : 1) * tile.w) / texture.width,
    ((tile.flipY ? -1 : 1) * tile.h) / texture.height,
  )
  return sprite
}

export function tileChunkView(chunk: TileChunk, context: ItemContext): Container {
  const view = new Container()
  for (const tile of chunk.tiles) view.addChild(tileSprite(tile, context))
  return view
}

export function intChunkView(chunk: IntChunk, context: ItemContext): Container {
  const view = new Graphics()
  for (const cell of chunk.cells) view.rect(cell.x, cell.y, cell.w, cell.h).fill(context.colors(cell.color))
  return view
}

/** Everything that decides how an entity looks, so an unchanged one keeps its view (`level-scene.ts`). */
export function entityKey(entity: EntityDraw, px: number): string {
  return JSON.stringify([entity, px])
}

export function entityView(entity: EntityDraw, context: ItemContext, px: number): Container {
  const view = new Container()
  const color = context.colors(entity.color)
  const shape = new Graphics()
  const { x, y, w, h, pivot } = entity
  if (entity.shape === 'tile' && entity.tile !== undefined) view.addChild(tileSprite(entity.tile, context))
  switch (entity.shape) {
    case 'ellipse':
      shape
        .ellipse(x + w / 2, y + h / 2, w / 2, h / 2)
        .fill({ color, alpha: 0.25 })
        .stroke({ color, width: px, alignment: 1 })
      break
    case 'point':
      shape.circle(pivot.x, pivot.y, 3 * px).fill(color)
      break
    case 'rect':
      shape.rect(x, y, w, h).fill({ color, alpha: 0.25 }).stroke({ color, width: px, alignment: 1 })
      break
    case 'tile':
      shape.rect(x, y, w, h).stroke({ color, width: px, alignment: 1 })
      break
  }
  if (entity.shape !== 'point') shape.circle(pivot.x, pivot.y, 1.5 * px).fill(color)
  view.addChild(shape)
  const label = new Text({
    text: entity.label,
    style: { fontFamily: 'sans-serif', fontSize: 11, fill: color },
    resolution: 2,
  })
  label.scale.set(px)
  label.position.set(x, y - 13 * px)
  view.addChild(label)
  return view
}

export const objectKey = (object: ObjectDraw): string => JSON.stringify(object)

export const objectView = (object: ObjectDraw, context: ItemContext): Container => tileSprite(object, context)

/** The background's image as the mode says; the colour is drawn under it in any case. */
function backgroundImage(texture: Texture, background: Background, size: Size): Container {
  const iw = texture.width
  const ih = texture.height
  switch (background.mode) {
    case 'repeat':
      return new TilingSprite({ texture, width: size.w, height: size.h })
    case 'repeat-x':
      return new TilingSprite({ texture, width: size.w, height: Math.min(ih, size.h) })
    case 'fit':
    case 'cover': {
      const scale = (background.mode === 'fit' ? Math.min : Math.max)(size.w / iw, size.h / ih)
      const sprite = new Sprite(texture)
      sprite.scale.set(scale)
      sprite.position.set((size.w - iw * scale) / 2, (size.h - ih * scale) / 2)
      return sprite
    }
  }
}

export function backgroundView(list: LevelDrawList, context: ItemContext): Container {
  const view = new Container()
  const { size, background } = list
  view.addChild(new Graphics().rect(0, 0, size.w, size.h).fill(context.colors(background.color)))
  const texture = background.image === undefined ? undefined : context.textures.texture(background.image)
  if (texture !== undefined) {
    view.addChild(backgroundImage(texture, background, size))
    // Cover and repeat-x can reach past the level; nothing is drawn outside it.
    const mask = new Graphics().rect(0, 0, size.w, size.h).fill(0xffffff)
    view.addChild(mask)
    view.mask = mask
  }
  return view
}

/** The grid, the footprint and the selection, over the layers. */
export function drawOverlays(overlay: Graphics, list: LevelDrawList, context: ItemContext, px: number): void {
  overlay.clear()
  const { grid, footprint, selection, size } = list
  if (grid !== undefined) {
    for (const x of grid.xs) overlay.moveTo(x, 0).lineTo(x, size.h)
    for (const y of grid.ys) overlay.moveTo(0, y).lineTo(size.w, y)
    overlay.stroke({ color: context.colors('border/strong'), width: px, alpha: 0.6 })
  }
  if (footprint !== undefined) {
    const color = context.colors(footprint.erase ? 'state/bad' : 'accent/default')
    overlay
      .rect(footprint.x, footprint.y, footprint.w, footprint.h)
      .fill({ color, alpha: 0.2 })
      .stroke({ color, width: 1.5 * px, alignment: 1 })
  }
  const accent = context.colors('accent/default')
  for (const box of selection)
    overlay.rect(box.x, box.y, box.w, box.h).stroke({ color: accent, width: 2 * px })
}
