// A figure in a Pixi 3D scene: the builder's own cell, painted by its `Figure` exactly as the review sheets draw it (8
// views, the pitch to 2°, the stepped pose clock), on a quad that stands on the figure's feet and faces the camera. The
// look is the painter's alone: the quad shows its texels, nearest neighbour, one texel to `metres / cell height`.
//
// The cell is an orthographic projection along the camera's pitch with the feet's texel on the figure's root, so the
// quad turns to face the camera square on (its yaw round the figure, then its pitch) and is anchored on that texel: under
// an orthographic camera the scene shows the cell's texels where the painter put them.
import { Sprite3D } from '@pixi/3d'
import { BufferImageSource, Texture } from 'pixi.js'
import { anchorOf, facing, type Point3, texelOf, viewFrom } from './camera.ts'
import { type CastMember, Figure, type FigureInput } from './door.ts'

export interface FigureSpriteInput extends Omit<FigureInput, 'view'> {
  /** The camera's position and the point it looks at. */
  readonly eye: Point3
  readonly target: Point3
  /** Where the figure stands in the scene. */
  readonly at: Point3
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

  /** Steps the figure by `dt` seconds toward `input` (its facing as the builder's: 0 toward +z) and shows the cell it
   * paints, turned to the camera. */
  update(dt: number, input: FigureSpriteInput): void {
    const { eye, target, at, ...rest } = input,
      view = viewFrom(eye, target, at)
    if (this.figure.update(dt, { ...rest, view })) {
      const painted = this.figure.painted
      this.source.resource = new Uint8Array(painted.buffer, painted.byteOffset, painted.byteLength)
      this.source.update()
    }
    this.sprite.quaternion.copyFrom(facing(view.azimuth, view.pitch))
  }

  destroy(): void {
    this.sprite.destroy({ texture: true, textureSource: true })
  }
}
