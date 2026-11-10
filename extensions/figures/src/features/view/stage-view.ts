import { View3D } from '@pixi/3d';
import type { V3 } from '../../lib/math';
import { checkPose } from '../stage/pose';
import type { StageFrame } from '../stage/stage';
import { poseQuaternion } from './camera';
import { CellSprite } from './cell-sprite';

/**
 * A `StageFrame` in a Pixi 3D view: one `CellSprite` per sprite, under a `Camera3D` set from the frame's `CameraPose`.
 * It holds no look: nothing but textured quads, so what the GPU draws is `compose(frame)` (`npm run view-check` proves
 * it, byte for byte, under the orthographic camera, and under perspective at whole pixels a texel).
 *
 * Each quad is square to the image plane (its axes the pose's `right` and `up`: `poseQuaternion`), never yawed to the
 * figure's own bearing, so the camera scales it evenly and every texel lands where `compose` puts it. It sits at
 * `eye + depth · fwd`, offset so its anchor texel lands on `screen + scale · anchor`. The placement goes by the GPU
 * camera's own centre, `(w / 2, h / 2)`, not the pose's `cx`, `cy`: `Camera3D`'s frustum is symmetric, so a pose with an
 * off-centre principal point lands where `compose` put it only when placed this way. A sprite's `depth` must lie
 * between the camera's near (0.1) and far (1000); `stageFrame` drops what is nearer than 0.1.
 */
export class StageView {
  /** Add this to the scene (`app.stage.addChild(stage.view)`). */
  readonly view: View3D;
  private readonly pool: CellSprite[] = [];

  constructor(private readonly size: [number, number]) {
    this.view = new View3D({ width: size[0], height: size[1], toneMapping: 'none' });
  }

  /** Draws `frame`: sets the camera, places a quad for each sprite far to near, and hides the rest of the pool. */
  draw(frame: StageFrame): void {
    const pose = frame.camera;
    checkPose(pose);
    const [w, h] = pose.size, cam = this.view.camera;
    if (w !== this.size[0] || h !== this.size[1]) throw new Error(`StageView: the frame is ${w}×${h}, the view ${this.size[0]}×${this.size[1]}`);
    const turn = poseQuaternion(pose);
    cam.position.set(...pose.eye);
    cam.quaternion.copyFrom(turn);
    cam.zoom = 1;   // it divides the field of view and multiplies the orthographic size: left at 1
    if (pose.f !== undefined) {
      cam.mode = 'perspective';
      cam.fov = 2 * Math.atan(h / 2 / pose.f) * 180 / Math.PI;   // Camera3D.fov is vertical and in degrees
    } else {
      cam.mode = 'orthographic';
      cam.orthographicSize = w / 2 / pose.pixelsPerMetre!;       // half the view's width; the height follows the aspect
    }
    frame.sprites.forEach((s, i) => {
      const quad = this.pool[i] ??= this.grow(), sprite = quad.sprite;
      quad.show(s.cell);
      // metres per screen pixel at the sprite's depth: d / f under perspective, 1 / pixelsPerMetre under orthographic
      const k = pose.f !== undefined ? s.depth / pose.f : 1 / pose.pixelsPerMetre!;
      const px = (s.screen[0] + s.scale * s.cell.anchor[0] - w / 2) * k, py = (s.screen[1] + s.scale * s.cell.anchor[1] - h / 2) * k;
      const p: V3 = [0, 1, 2].map(c => pose.eye[c] + s.depth * pose.fwd[c] + px * pose.right[c] - py * pose.up[c]) as V3;
      sprite.position.set(...p);
      sprite.quaternion.copyFrom(turn);
      sprite.pixelSize = s.scale * k;
      sprite.visible = true;
    });
    for (let i = frame.sprites.length; i < this.pool.length; i++) this.pool[i].sprite.visible = false;
  }

  private grow(): CellSprite {
    const quad = new CellSprite();
    this.view.root.addChild(quad.sprite);
    return quad;
  }

  destroy(): void {
    for (const q of this.pool) q.destroy();
    this.view.destroy();
  }
}
