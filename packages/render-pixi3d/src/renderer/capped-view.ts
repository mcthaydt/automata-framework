import type { View3D } from '@pixi/3d'
import { Container, type Renderer, RenderTexture, Sprite } from 'pixi.js'

/** A width and a height in pixels. */
export interface ViewSize {
  readonly width: number
  readonly height: number
}

/**
 * The size the 3D view draws at for a `screen` of CSS pixels when it may be at most `maxHeight` pixels tall: the
 * screen's own size when it fits, else scaled down to `maxHeight` keeping the aspect. Whole pixels, at least one.
 */
export function cappedViewSize(screen: ViewSize, maxHeight: number): ViewSize {
  const scale = screen.height > maxHeight ? maxHeight / screen.height : 1
  return {
    width: Math.max(1, Math.round(screen.width * scale)),
    height: Math.max(1, Math.round(screen.height * scale)),
  }
}

/**
 * A full-page `View3D` drawn at a capped internal size, then nearest-upscaled to fill the screen (G3-x).
 *
 * A view that follows the screen shades every device pixel: a phone at resolution 2 is millions of fragments a frame,
 * and on software rendering that is what makes the frame slow. Here the view draws into a texture at resolution 1 and
 * at most `maxHeight` pixels tall, and a sprite stretches that texture over the screen with nearest sampling, so the
 * cost is bounded by the cap whatever the screen, and the picture reads as chunky pixels, like the 2D games'
 * composite. The 2D layers over it (`stage.ui`) keep the screen's resolution.
 */
export class CappedView {
  /** What the texture is drawn from: the view alone. */
  private readonly stage = new Container()
  private readonly texture: RenderTexture
  /** What the page shows: the texture, stretched over the screen. */
  readonly sprite: Sprite

  constructor(
    private readonly view: View3D,
    private readonly maxHeight: number,
  ) {
    this.stage.label = 'capped-view'
    this.stage.addChild(view)
    // Resized when the screen changes; a dynamic texture makes the sprite rebuild its quad (as the 2D composite does).
    this.texture = RenderTexture.create({
      width: 1,
      height: 1,
      resolution: 1,
      scaleMode: 'nearest',
      dynamic: true,
    })
    this.sprite = new Sprite(this.texture)
    this.sprite.label = 'capped-view-sprite'
  }

  /**
   * Draws the view into its texture at the size the screen calls for now. Called once a frame, after everything that
   * moves the scene, before the app renders the page.
   */
  present(renderer: Renderer): void {
    const { width, height } = renderer.screen
    const size = cappedViewSize({ width, height }, this.maxHeight)
    if (size.width !== this.texture.width || size.height !== this.texture.height) {
      this.texture.resize(size.width, size.height)
      this.view.setSize(size.width, size.height)
    }
    this.sprite.setSize(width, height)
    renderer.render({ container: this.stage, target: this.texture, clear: true })
  }

  /** Frees the sprite, the texture and the view (which the page's stage no longer holds, so its teardown misses it). */
  destroy(): void {
    this.sprite.destroy()
    this.texture.destroy(true)
    this.stage.destroy({ children: true })
  }
}
