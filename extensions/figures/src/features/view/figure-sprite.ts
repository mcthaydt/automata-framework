import type { Sprite3D } from '@pixi/3d';
import type { V3 } from '../../lib/math';
import type { CastMember } from '../figure/cast';
import { Figure, type FigureInput } from '../figure/figure';
import { cellOf } from '../stage/cell';
import { CellSprite } from './cell-sprite';
import { facing, texelOf, viewFrom } from './camera';

/**
 * A figure in a Pixi 3D scene: the painter's own cell, drawn by `Figure` exactly as the sheets draw it (8 directions,
 * the pitch to 2°, the stepped pose clock), shown on a quad that stands on the figure's feet and faces the camera.
 * Nothing about the look is redone here: the quad shows the painted texels, nearest neighbour, one texel to
 * `metres / cell height` of the scene. It is a `CellSprite` fed by its own `Figure` through `cellOf`.
 *
 * The cell is an orthographic projection along the camera's pitch with the feet's texel on the figure's root, so the
 * quad is turned to face the camera square on (its yaw round the figure, then its pitch) and anchored on that texel:
 * under an orthographic camera the scene then shows the cell's texels where the painter put them. (A whole stage
 * frame, under any camera, is `StageView`'s, whose quads are square to the image plane.)
 */

export interface FigureSpriteInput extends Omit<FigureInput, 'view'> {
  /** The camera's position and the point it looks at (scene metres). */
  eye: V3; target: V3;
}

export class FigureSprite {
  readonly figure: Figure;
  readonly sprite: Sprite3D;
  private readonly cell = new CellSprite();

  constructor(readonly cast: CastMember) {
    this.figure = new Figure(cast);
    this.sprite = this.cell.sprite;
    this.sprite.pixelSize = texelOf(cast);
    this.sprite.label = 'FigureSprite';
    this.cell.show(cellOf(this.figure));   // sizes the texture and the anchor before the first update
  }

  /** Steps the figure by `dt` seconds toward `input` (its facing in the scene, as the figure's: 0 toward +z) and shows
   * the cell it paints, turned to the camera. */
  update(dt: number, input: FigureSpriteInput): void {
    const p = this.sprite.position, at: V3 = [p.x, p.y, p.z];
    const { eye, target, ...rest } = input, view = viewFrom(eye, target, at);
    if (this.figure.update(dt, { ...rest, view })) this.cell.show(cellOf(this.figure));
    this.sprite.quaternion.copyFrom(facing(view.azimuth, view.pitch));
  }

  destroy(): void { this.cell.destroy(); }
}
