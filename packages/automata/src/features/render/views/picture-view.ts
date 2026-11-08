import {
  type ContentEntityDef,
  type ContentProject,
  pictureOf,
  placeholderColor,
  tileFrame,
} from '@automata/content/level-2d'
import type { FieldRecord } from '@automata/sim'
import { Container, Graphics, Sprite } from 'pixi.js'
import type { EntityViewFactory } from '../delta/render-delta-consumer.js'
import { picturesOf } from '../level-2d/pictures.js'
import { placeView } from './view-pose.js'

/** A `pictureView`'s options. */
export interface PictureViewOptions {
  /**
   * The name of the clip to play now, read from the entity's components each frame. Code picks the clip by name;
   * what the clip looks like is the character's, edited in Characters.
   */
  readonly clip?: ((components: Readonly<Record<string, Readonly<FieldRecord>>>) => string) | undefined
}

const report = (message: string): void => globalThis.reportError?.(new Error(message))

const hex = (color: string): number => Number.parseInt(color.slice(1), 16)

/** A flat shape of the definition's colour, its pivot at the origin. */
function flatShape(def: ContentEntityDef, shape: 'rect' | 'ellipse' | 'point', color: string): Graphics {
  const graphics = new Graphics()
  const { w, h } = def.size
  if (shape === 'point') return graphics.circle(0, 0, 3).fill(hex(color))
  const x = -def.pivot.x * w
  const y = -def.pivot.y * h
  if (shape === 'ellipse') graphics.ellipse(x + w / 2, y + h / 2, w / 2, h / 2)
  else graphics.rect(x, y, w, h)
  return graphics.fill(hex(color))
}

/**
 * An entity drawn as its character looks in the editor: the tile Characters gave it, else its colour as its shape.
 * The view follows the entity's `x`, `y` and `angle` like `rect` and `sprite`, and is anchored at the character's
 * pivot. A picture that has not arrived (or a tile past its set) shows the tile's flat colour, never a blank:
 * `registerViews({ [Body.id]: pictureView(project, 'player-start', images) })`.
 */
export function pictureView(
  project: ContentProject,
  def: string,
  images: Readonly<Record<string, string>>,
  _options: PictureViewOptions = {},
): EntityViewFactory {
  const character = project.entities.find((candidate) => candidate.id === def)
  if (character === undefined) throw new Error(`There is no character "${def}" in the project.`)
  const picture = pictureOf(character)
  const pictures = picturesOf(images)
  const told = new Set<string>()
  const once = (message: string): void => {
    if (told.has(message)) return
    told.add(message)
    report(message)
  }

  /** The tile's sprite when its picture is loaded, else its placeholder colour. */
  function tileLook(tilesetId: string, index: number): Container {
    const tileset = project.tilesets.find((candidate) => candidate.id === tilesetId)
    const flat = (): Graphics => flatShape(character as ContentEntityDef, 'rect', placeholderColor(index))
    if (tileset === undefined) {
      once(
        `The character "${character?.label ?? def}" uses the tileset "${tilesetId}", which is not in the project.`,
      )
      return flat()
    }
    const frame = tileFrame(tileset, index)
    if (frame === undefined) {
      once(
        `The character "${character?.label ?? def}" uses tile ${index}, but "${tileset.id}" has ${tileset.columns * tileset.rows} tiles.`,
      )
      return flat()
    }
    if (tileset.image === undefined) return flat()
    if (images[tileset.image] === undefined) {
      once(
        `The character "${character?.label ?? def}" uses the picture "${tileset.image}", which is not in the game.`,
      )
      return flat()
    }
    const cut = pictures.cut(tileset.image, frame)
    if (cut === undefined) return flat()
    const sprite = new Sprite(cut)
    sprite.anchor.set(character?.pivot.x ?? 0.5, character?.pivot.y ?? 0.5)
    sprite.width = character?.size.w ?? frame.w
    sprite.height = character?.size.h ?? frame.h
    return sprite
  }

  const look = (): Container =>
    picture.kind === 'tile'
      ? tileLook(picture.tileset, picture.index)
      : flatShape(character, picture.shape, picture.color)

  return (_row, componentId) => {
    const container = new Container()
    let shown = look()
    container.addChild(shown)
    // A tile's picture may arrive after the view was made: swap the flat colour for the sprite.
    const stop =
      picture.kind === 'tile'
        ? pictures.onLoad(() => {
            if (container.destroyed) return
            shown.destroy()
            shown = look()
            container.addChild(shown)
          })
        : undefined
    return {
      container,
      update(curr, prev, alpha = 1) {
        placeView(container, curr, prev, alpha, componentId)
      },
      destroy() {
        stop?.()
        container.destroy({ children: true })
      },
    }
  }
}
