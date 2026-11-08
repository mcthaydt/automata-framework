import {
  type ContentEntityDef,
  type ContentProject,
  pictureOf,
  placeholderColor,
  tileFrame,
} from '@automata/content/level-2d'
import type { FieldRecord } from '@automata/sim'
import { type AnimatedSprite, Container, Graphics, Sprite } from 'pixi.js'
import type { EntityViewFactory } from '../delta/render-delta-consumer.js'
import { clipSprite, clipTextures, playClip } from '../level-2d/clips.js'
import { picturesOf } from '../level-2d/pictures.js'
import { placeView } from './view-pose.js'

/** A `pictureView`'s options. */
export interface PictureViewOptions {
  /**
   * The name of the clip to play now, read from the entity's components each frame. Code picks the clip by name;
   * what the clip looks like is the character's, edited in Characters.
   */
  readonly clip?: ((components: Readonly<Record<string, Readonly<FieldRecord>>>) => string) | undefined
  /**
   * Moves the picture off the entity's position, for a game whose position is not the character's pivot (a body
   * whose `x`, `y` is its centre while the character stands on its pivot, its feet). Default none.
   */
  readonly offset?: { readonly x: number; readonly y: number } | undefined
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
  options: PictureViewOptions = {},
): EntityViewFactory {
  const character = project.entities.find((candidate) => candidate.id === def)
  if (character === undefined) throw new Error(`There is no character "${def}" in the project.`)
  // The still look: the clip is played by `animatedLook`, and this is what shows while its picture has not arrived.
  const looked = pictureOf(character)
  const picture = looked.kind === 'clip' ? looked.still : looked
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

  const animation = character.animation
  const firstClip = animation?.clips[0]
  /** The animated sprite on its first clip, or the colour while the picture loads. */
  const animatedLook = (): Container => {
    if (animation === undefined || firstClip === undefined) return flatLook()
    const textures = clipTextures(pictures, animation, firstClip)
    if (textures === undefined) {
      if (images[animation.image] === undefined)
        once(
          `The character "${character.label ?? def}" uses the picture "${animation.image}", which is not in the game.`,
        )
      return flatLook()
    }
    const sprite = clipSprite(textures, firstClip)
    sprite.anchor.set(character.pivot.x, character.pivot.y)
    sprite.width = character.size.w
    sprite.height = character.size.h
    return sprite
  }
  const flatLook = (): Container =>
    picture.kind === 'tile'
      ? tileLook(picture.tileset, picture.index)
      : flatShape(character, picture.shape, picture.color)

  const look = (): Container => (animation === undefined ? flatLook() : animatedLook())

  return (_row, componentId) => {
    const container = new Container()
    let shown = look()
    container.addChild(shown)
    let playing = firstClip?.id
    // A picture may arrive after the view was made: swap the colour for the sprite.
    const stop =
      picture.kind === 'tile' || animation !== undefined
        ? pictures.onLoad(() => {
            if (container.destroyed) return
            shown.destroy()
            shown = look()
            playing = firstClip?.id
            container.addChild(shown)
          })
        : undefined

    /** Plays the clip the game names now, from its first frame, once; a name the character lacks keeps the one playing. */
    const pick = (components: Readonly<Record<string, Readonly<FieldRecord>>>): void => {
      if (options.clip === undefined || animation === undefined) return
      const name = options.clip(components)
      if (name === playing) return
      const clip = animation.clips.find((candidate) => candidate.id === name)
      if (clip === undefined) {
        once(`The character "${character.label ?? def}" has no clip "${name}".`)
        return
      }
      const sprite = shown as AnimatedSprite
      const textures = clipTextures(pictures, animation, clip)
      if (textures === undefined || sprite.textures === undefined) return
      playClip(sprite, textures, clip)
      playing = name
    }

    return {
      container,
      update(curr, prev, alpha = 1) {
        placeView(container, curr, prev, alpha, componentId)
        if (options.offset !== undefined)
          container.position.set(container.x + options.offset.x, container.y + options.offset.y)
        pick(curr)
      },
      destroy() {
        stop?.()
        container.destroy({ children: true })
      },
    }
  }
}
