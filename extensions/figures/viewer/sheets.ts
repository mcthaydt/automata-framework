import { Figure, evaluate, type CastMember } from '../src';
import { standOf } from '../src/features/figure/cast';
import { view } from '../src/features/figure/frames';

/**
 * The review sheets' stepping with the `Figure` kept: `standing`, `walking` and `hero` of features/figure/frames.ts,
 * replayed so a caller sees the figure at the moment the sheet keeps each frame. The contract's tests
 * (tests/features/stage/sheets.test.ts) and the view's check cases (viewer/cases.ts) share it, so the GPU case and the
 * golden test draw the same frames. Node-free and Pixi-free: it runs in the browser and in Node.
 *
 * `each(kind, index, figure)` is called with `'turn'` 0–7, `'walk'` 0–(poses − 1) and `'hero'` 0; the figure is the
 * sheet's own, valid until `each` returns.
 */
export type SheetEach = (kind: 'turn' | 'walk' | 'hero', index: number, figure: Figure) => void;

export function sheetFigures(cast: CastMember, pitch: number, each: SheetEach, heroPose?: string): void {
  // standing: a fresh figure, three updates facing view d.
  for (let d = 0; d < 8; d++) {
    const f = new Figure(cast);
    for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: d * Math.PI / 4, moving: false, view: view(pitch) });
    each('turn', d, f);
  }
  // walking: four cycles, each pose written again every cycle, and the sheet keeps the last write (the hair has
  // settled). The phase does not depend on the figure, so find each pose's last step first, then replay calling `each`.
  const dt = 1 / 60, poses = cast.gait.walkPoses, steps = Math.round(cast.gait.cycle * 4 * 60), last: number[] = [];
  let phase = 0;
  for (let s = 0; s < steps; s++) { phase = (phase + dt / cast.gait.cycle) % 1; last[Math.floor(phase * poses)] = s; }
  const w = new Figure({ ...cast, blink: 0 });
  phase = 0;
  for (let s = 0; s < steps; s++) {
    phase = (phase + dt / cast.gait.cycle) % 1;
    w.update(dt, { facing: Math.PI / 4, moving: true, view: view(pitch) });
    const k = Math.floor(phase * poses);
    if (last[k] === s) each('walk', k, w);
  }
  // hero: the named stand drawn as a made pose, or the relaxed stand when the outfit suits none.
  const facing = Math.PI / 4, f = new Figure(cast), input = { facing, moving: false, view: view(pitch) }, s = f.skeleton;
  const placed = heroPose ? standOf(s, cast.outfits[cast.defaultOutfit](s), heroPose) : null;
  if (!placed) { for (let i = 0; i < 3; i++) f.update(1 / 60, input); each('hero', 0, f); return; }
  const rel = Math.round((facing - input.view.azimuth) / (Math.PI / 4)) * (Math.PI / 4);
  const st = { ...f.motion(input, 0, 0, facing, rel), yaw: 0, view: rel, stand: placed.stand, holds: placed.holds };
  f.update(1 / 60, { ...input, pose: { key: 'hero', pose: evaluate(s, cast.gait, st).pose } });
  each('hero', 0, f);
}
