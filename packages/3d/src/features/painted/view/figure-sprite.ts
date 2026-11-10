import { Sprite3D } from '@pixi/3d'
import { BufferImageSource, Texture } from 'pixi.js'
import type { CastMember } from '../figure/cast.ts'
import { Figure, type FigureInput } from '../figure/figure.ts'
import type { V3 } from '../lib/math.ts'
import { anchorOf, facing, texelOf, viewFrom } from './camera.ts'

/**
 * A figure in a Pixi 3D scene: the painter's own cell, drawn by `Figure` exactly as the sheets draw it (8 directions,
 * the pitch to 2°, the stepped pose clock), shown on a quad that stands on the figure's feet and faces the camera.
 * Nothing about the look is redone here: the quad shows the painted texels, nearest neighbour, one texel to
 * `metres / cell height` of the scene.
 *
 * The cell is an orthographic projection along the camera's pitch with the feet's texel on the figure's root, so the
 * quad is turned to face the camera square on (its yaw round the figure, then its pitch) and anchored on that texel:
 * under an orthographic camera the scene then shows the cell's texels where the painter put them.
 */

export interface FigureSpriteInput extends Omit<FigureInput, 'view'> {
  /** The camera's position and the point it looks at (scene metres). */
  eye: V3
  target: V3
}

export class FigureSprite {
  readonly figure: Figure
  readonly sprite: Sprite3D
  private readonly source: BufferImageSource

  constructor(readonly cast: CastMember) {
    this.figure = new Figure(cast)
    const [w, h] = cast.cell
    this.source = new BufferImageSource({
      resource: new Uint8Array(w * h * 4),
      width: w,
      height: h,
      scaleMode: 'nearest',
      alphaMode: 'no-premultiply-alpha',
    })
    this.sprite = new Sprite3D({
      texture: new Texture({ source: this.source }),
      billboardMode: 'none',
      anchor: anchorOf(cast),
      pixelSize: texelOf(cast),
      alphaMode: 'mask',
      label: 'FigureSprite',
    })
  }

  /** Steps the figure by `dt` seconds toward `input` (its facing in the scene, as the figure's: 0 toward +z) and shows
   * the cell it paints, turned to the camera. */
  update(dt: number, input: FigureSpriteInput): void {
    const p = this.sprite.position,
      at: V3 = [p.x, p.y, p.z]
    const { eye, target, ...rest } = input,
      view = viewFrom(eye, target, at)
    if (this.figure.update(dt, { ...rest, view })) {
      this.source.resource = new Uint8Array(
        this.figure.painted.buffer,
        this.figure.painted.byteOffset,
        this.figure.painted.byteLength,
      )
      this.source.update()
    }
    this.sprite.quaternion.copyFrom(facing(view.azimuth, view.pitch))
  }

  destroy(): void {
    this.sprite.destroy({ texture: true, textureSource: true })
  }
}
