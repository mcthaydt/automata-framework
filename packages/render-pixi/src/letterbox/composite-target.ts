import { Container, Rectangle, RenderTexture, Sprite } from 'pixi.js'
import type { LetterboxFrame } from './letterbox.js'

/**
 * The fixed-resolution composite (M4 spec §4.11).
 *
 * The world and the UI draw here first, at resolution 1 and exactly the play field's logical size, and the result is
 * nearest-upscaled into the letterbox. Two reasons, and the second is the durable one. Filters cost per pixel, and a
 * device-resolution frame on a phone is several times the work; bounding the chain to the logical size makes the
 * cost the same everywhere. More importantly, pixel art sampled at a fractional device scale is pixel art with torn
 * edges, so compositing at 1:1 and upscaling by whole pixels is correct whatever the cost.
 *
 * From FloorFifty `apps/client/src/systems/render/render-target.ts` at `ac72660`; FloorFifty's fixed 960 × 540 is
 * the game's logical size here.
 */
export class CompositeTarget {
  /** What the world and the UI draw into. Not the backdrop: see `adopt`. */
  readonly stage: Container = new Container()
  /** What the letterbox displays. */
  readonly sprite: Sprite
  /** The texture the stage renders into each frame. */
  readonly texture: RenderTexture

  private readonly width: number

  constructor(size: { readonly width: number; readonly height: number }) {
    this.width = size.width
    this.stage.label = 'composite'
    // Pinned to the target's size so Pixi skips computing the whole world's bounds for the filters each frame.
    this.stage.filterArea = new Rectangle(0, 0, size.width, size.height)
    this.texture = RenderTexture.create({
      width: size.width,
      height: size.height,
      resolution: 1,
      scaleMode: 'nearest',
      // Resized when a rotation changes the field. A dynamic texture makes the sprite rebuild its quad; without it
      // the sprite keeps the first frame's quad and stretches the new size.
      dynamic: true,
    })
    this.sprite = new Sprite(this.texture)
    this.sprite.label = 'composite-sprite'
    this.stage.filters = []
  }

  /**
   * Moves a frame's world and UI into the target, and puts the target's sprite where they were.
   *
   * The backdrop is deliberately left where it is: it is the one layer that is not clipped, and a target of the
   * play field's size would bound it to exactly the rectangle it exists to escape. It keeps device resolution.
   */
  adopt(frame: LetterboxFrame): void {
    this.stage.addChild(frame.world, frame.ui)
    frame.root.addChild(this.sprite)
  }

  /** Resizes the target to a field `height` logical units tall; a no-op when the height has not changed. */
  resize(height: number): void {
    this.stage.filterArea = new Rectangle(0, 0, this.width, height)
    if (this.texture.height === height) return
    this.texture.resize(this.width, height)
  }

  destroy(): void {
    this.sprite.destroy()
    this.texture.destroy(true)
    this.stage.destroy({ children: true })
  }
}
