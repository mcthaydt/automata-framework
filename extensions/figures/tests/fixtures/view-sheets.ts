import { type CastMember, evaluate, Figure } from '#src/entries/index.ts'
import { standOf } from '#src/shared/figure/cast.ts'
import { view } from '#src/shared/figure/frames.ts'

/**
 * The review sheets' stepping with the `Figure` kept: `standing`, `walking` and `hero` of shared/figure/frames.ts,
 * replayed so a caller sees the figure at the moment the sheet keeps each frame. The contract's tests
 * (tests/unit/stage/sheets.test.ts) and the view's check cases (tests/fixtures/view-cases.ts) share it, so the GPU case and the
 * golden test draw the same frames. Node-free and Pixi-free: it runs in the browser and in Node.
 *
 * `each(kind, index, figure)` is called with `'turn'` 0–7, `'walk'` 0–(poses − 1) and `'hero'` 0; the figure is the
 * sheet's own, valid until `each` returns.
 */
export type SheetKind = 'turn' | 'walk' | 'hero'
export type SheetEach = (kind: SheetKind, index: number, figure: Figure) => void

/** Replays the sheets of `cast` at `pitch`; `only` limits it to one sheet (the walk is the slow one). */
export function sheetFigures(
  cast: CastMember,
  pitch: number,
  each: SheetEach,
  heroPose?: string,
  only?: SheetKind,
): void {
  if (!only || only === 'turn') turnSheet(cast, pitch, each)
  if (!only || only === 'walk') walkSheet(cast, pitch, each)
  if (!only || only === 'hero') heroSheet(cast, pitch, each, heroPose)
}

/** Standing: a fresh figure, three updates facing view d. */
function turnSheet(cast: CastMember, pitch: number, each: SheetEach): void {
  for (let d = 0; d < 8; d++) {
    const f = new Figure(cast)
    for (let i = 0; i < 3; i++)
      f.update(1 / 60, { facing: (d * Math.PI) / 4, moving: false, view: view(pitch) })
    each('turn', d, f)
  }
}

/** Walking: four cycles, each pose written again every cycle, and the sheet keeps the last write (the hair has settled).
 * The phase does not depend on the figure, so find each pose's last step first, then replay calling `each` there. */
function walkSheet(cast: CastMember, pitch: number, each: SheetEach): void {
  const dt = 1 / 60,
    poses = cast.gait.walkPoses,
    steps = Math.round(cast.gait.cycle * 4 * 60),
    last: number[] = []
  let phase = 0
  for (let s = 0; s < steps; s++) {
    phase = (phase + dt / cast.gait.cycle) % 1
    last[Math.floor(phase * poses)] = s
  }
  const f = new Figure({ ...cast, blink: 0 })
  phase = 0
  for (let s = 0; s < steps; s++) {
    phase = (phase + dt / cast.gait.cycle) % 1
    f.update(dt, { facing: Math.PI / 4, moving: true, view: view(pitch) })
    const k = Math.floor(phase * poses)
    if (last[k] === s) each('walk', k, f)
  }
}

/** The hero: the named stand drawn as a made pose, or the relaxed stand when the outfit suits none. */
function heroSheet(cast: CastMember, pitch: number, each: SheetEach, heroPose?: string): void {
  const facing = Math.PI / 4,
    f = new Figure(cast),
    input = { facing, moving: false, view: view(pitch) },
    s = f.skeleton
  const placed = heroPose ? standOf(s, cast.outfits[cast.defaultOutfit](s), heroPose) : null
  if (!placed) {
    for (let i = 0; i < 3; i++) f.update(1 / 60, input)
    each('hero', 0, f)
    return
  }
  const rel = Math.round((facing - input.view.azimuth) / (Math.PI / 4)) * (Math.PI / 4)
  const st = {
    ...f.motion(input, 0, 0, facing, rel),
    yaw: 0,
    view: rel,
    stand: placed.stand,
    holds: placed.holds,
  }
  f.update(1 / 60, { ...input, pose: { key: 'hero', pose: evaluate(s, cast.gait, st).pose } })
  each('hero', 0, f)
}
