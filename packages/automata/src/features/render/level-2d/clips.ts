import type { ContentAnimation, ContentClip } from '@automata/content/level-2d'
import { AnimatedSprite, type Texture } from 'pixi.js'
import type { Pictures } from './pictures.js'

// A character's clips as Pixi's animated sprite. Both `pictureView` (an entity the sim spawned) and `levelScene` (a
// character placed in the level) use it, so a clip looks the same in either. The sprite times itself on Pixi's shared
// ticker: clip timing is presentation time, and the sim never reads it.

/** Pixi's `animationSpeed` is frames per tick of a 60 a second ticker. */
const TICKS_PER_SECOND = 60

/**
 * The textures of one clip's frames, cut from the loaded picture; undefined until the picture has arrived. A frame the
 * picture does not have is left out (cutting past the picture would draw nothing, or a neighbour), and `missing` is told
 * which one and how many the picture has, for the caller to say in words.
 */
export function clipTextures(
  pictures: Pictures,
  animation: ContentAnimation,
  clip: ContentClip,
  missing?: (frame: number, count: number) => void,
): Texture[] | undefined {
  const sheet = pictures.texture(animation.image)
  if (sheet === undefined) return undefined
  const { w, h } = animation.frame
  const columns = Math.max(1, Math.floor(sheet.width / w))
  const count = columns * Math.max(1, Math.floor(sheet.height / h))
  const cuts: Texture[] = []
  for (const index of clip.frames) {
    if (index >= count) {
      missing?.(index, count)
      continue
    }
    const cut = pictures.cut(animation.image, {
      x: (index % columns) * w,
      y: Math.floor(index / columns) * h,
      w,
      h,
    })
    if (cut === undefined) return undefined
    cuts.push(cut)
  }
  // A clip with no frame the picture has plays nothing: the caller shows the look it has without a picture.
  return cuts.length === 0 ? undefined : cuts
}

/** Plays `clip` on `sprite` from its first frame, at the clip's speed. A clip that does not repeat stops on its last frame. */
export function playClip(sprite: AnimatedSprite, textures: Texture[], clip: ContentClip): void {
  sprite.textures = textures
  sprite.animationSpeed = clip.fps / TICKS_PER_SECOND
  sprite.loop = clip.loop
  sprite.gotoAndPlay(0)
}

/** A new animated sprite playing `clip`. */
export function clipSprite(textures: Texture[], clip: ContentClip): AnimatedSprite {
  const sprite = new AnimatedSprite(textures, true)
  playClip(sprite, textures, clip)
  return sprite
}
