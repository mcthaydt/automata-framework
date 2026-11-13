import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createDirector, fovOf } from '@automata/cutscenes/director'
import { type CutsceneScript, placeScript } from '@automata/cutscenes/sim'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { PLAY_FIGURE } from '#src/features/figures/cast.ts'

// In play a figure's texel is a whole number of field pixels (`camera-rules.test.ts`: one, a zoom of about 2.3, stood back as the old
// game's camera). A cutscene's shot sets its own lens and stands where it likes, and its lenses were set for the near camera's density:
// while a shot draws, the figure is the painter's density-2 cell on every field (`PLAY_FIGURE`, by `figureDensity`, so no shot picks a
// density of its own and an actor key's `density` is not read by the 3D stage), placed crisp, `round(zoom / 2)` whole field
// pixels a texel. Crisp, a texel is always whole; what a shot decides is how far that rounding stretches or shrinks her: at a zoom of
// 5.2 her texel is drawn 3 pixels where it should be 2.6, and she stands 15% too tall, and a push-in that crosses a half (2.5, 3.5)
// pops her a whole texel bigger in the middle of the shot. So every shot holds the zoom her texel is drawn at within 3% of a whole
// number of field pixels (the play camera's tolerance), at every moment it is on screen, for every figure in its frame.

const ROOT = join(import.meta.dirname, '../../..')
/** The field's lines at 4:3 (1024 by 768 at 2x), as the play camera's rule counts them. */
const FIELD_LINES = 384
const FIELD_WIDTH = 512
/** The painter's density-1 texels to a metre (a 96-row cell is 2.6 m): `zoomOf` counts field pixels per one of them. */
const D1_TEXELS = 96 / 2.6
/** Her height (the cast's 1.62 m): a figure is in the frame when any of her, feet to head, is. */
const HEIGHT = 1.62
const TOLERANCE = 0.03
/** How finely a shot is read: every frame at 60 Hz. */
const STEP = 1 / 60

type V3 = readonly [number, number, number]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const unit = (a: V3): V3 => {
  const n = Math.hypot(a[0], a[1], a[2])
  return [a[0] / n, a[1] / n, a[2] / n]
}
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

/** The game's scripts, placed. `found` stands about where she was caught: any place does, as its camera stands about it too. */
const scripts = readdirSync(join(ROOT, 'content/cutscenes')).map((name) => {
  const raw = parse(readFileSync(join(ROOT, 'content/cutscenes', name), 'utf8')) as unknown as CutsceneScript
  // The figure that caught her stands where the play left it, so `found`'s first shot cannot know her scale: she is put out of sight.
  const placed = placeScript(raw, (anchor) => (anchor === 'player' ? { x: 0, z: 0 } : { x: 0, z: 99 }))
  if (!placed.ok) throw new Error(`${raw.id}: ${placed.missing.join(', ')}`)
  return placed.script
})

/** One shot: the keys from one cut to the next. */
interface Shot {
  readonly id: string
  readonly index: number
  readonly from: number
  readonly to: number
}

function shotsOf(script: (typeof scripts)[number]): Shot[] {
  const starts = script.camera.filter((k, i) => i === 0 || k.cut === true).map((k) => k.t)
  return starts.map((from, index) => ({
    id: script.id,
    index,
    from,
    to: starts[index + 1] ?? script.duration,
  }))
}

/** A figure's texel at one moment: field pixels a density-2 texel covers at her feet, or undefined when she is out of the frame. */
function texelAt(
  camera: { pos: V3; look: V3; fov: number },
  at: V3,
): { texel: number; depth: number } | undefined {
  const fwd = unit(sub(camera.look, camera.pos))
  const right = unit(cross(fwd, [0, 1, 0]))
  const up = cross(right, fwd)
  const f = FIELD_LINES / 2 / Math.tan((camera.fov * Math.PI) / 360)
  const screen = (p: V3): [number, number] | undefined => {
    const q = sub(p, camera.pos)
    const d = dot(q, fwd)
    if (d < 0.1) return undefined
    return [FIELD_WIDTH / 2 + (f * dot(q, right)) / d, FIELD_LINES / 2 - (f * dot(q, up)) / d]
  }
  const feet = screen(at)
  const head = screen([at[0], at[1] + HEIGHT, at[2]])
  if (feet === undefined || head === undefined) return undefined
  const depth = dot(sub(at, camera.pos), fwd)
  // In the frame when her middle is: a sliver of her sprite's side at the frame's edge is not a figure the shot frames.
  const inX = [feet[0], head[0]].some((x) => x >= 0 && x <= FIELD_WIDTH)
  const inY = Math.min(feet[1], head[1]) < FIELD_LINES && Math.max(feet[1], head[1]) > 0
  if (!inX || !inY) return undefined
  return { texel: f / depth / D1_TEXELS / PLAY_FIGURE.density, depth }
}

/** Every figure's texel through a shot, frame by frame: the smallest and largest, and the whole number it is drawn at. */
interface ShotScale {
  readonly shot: string
  readonly who: string
  readonly min: number
  readonly max: number
  readonly drawn: number
  /** The worst share by which the drawn texel misses the true one. */
  readonly off: number
}

function scalesOf(): ShotScale[] {
  const out: ShotScale[] = []
  for (const script of scripts)
    for (const shot of shotsOf(script)) {
      const director = createDirector(script, () => {})
      const seen = new Map<string, number[]>()
      // The last frame of a shot is the moment before the next one's cut.
      for (let t = shot.from; t < shot.to - 1e-6; t += STEP) {
        const state = director.stateAt(Math.min(t, shot.to - 1e-6))
        for (const [who, actor] of Object.entries(state.actors)) {
          if (actor.alpha <= 0) continue
          const scale = texelAt(state.camera, [actor.x, actor.y ?? 0, actor.z])
          if (scale !== undefined) seen.set(who, [...(seen.get(who) ?? []), scale.texel])
        }
      }
      for (const [who, texels] of seen) {
        const min = Math.min(...texels)
        const max = Math.max(...texels)
        const drawn = Math.max(1, Math.round((min + max) / 2))
        const off = Math.max(...texels.map((t) => Math.abs(Math.max(1, Math.round(t)) / t - 1)))
        out.push({
          shot: `${shot.id} ${shot.index + 1} (${shot.from}-${shot.to} s)`,
          who,
          min,
          max,
          drawn,
          off,
        })
      }
    }
  return out
}

describe('the prologue’s cutscenes', () => {
  it('paints every figure at density 2, as in play, so a texel is `round(zoom / 2)` field pixels', () => {
    expect(PLAY_FIGURE.density).toBe(2)
    expect(PLAY_FIGURE.crisp).toBe(true)
    expect(fovOf(50)).toBeCloseTo(26.99, 2)
  })

  it('reads a figure in the frame in every shot but the two inserts, so no figure leaves a shot that meant her', () => {
    const shots = scripts.flatMap(shotsOf).map((s) => `${s.id} ${s.index + 1}`)
    const framed = new Set(scalesOf().map((s) => s.shot.split(' (')[0]))
    // The opening's third shot is the noticeboard on its own, her note on it, and the keypad's is the cabinet's pad, Ada beside it out of
    // the frame: nobody is in either.
    expect(shots.filter((s) => !framed.has(s))).toEqual(['keypad 1', 'opening 3'])
  })

  it('holds each figure in frame within 3% of a whole number of field pixels a texel, every frame of every shot', () => {
    const scales = scalesOf()
    if (process.env.CUTSCENE_SCALE_TABLE === '1')
      console.log(
        scales
          .map(
            (s) =>
              `| ${s.shot} | ${s.who} | ${s.min.toFixed(2)} to ${s.max.toFixed(2)} | ${s.drawn} | ${(s.off * 100).toFixed(1)}% |`,
          )
          .join('\n'),
      )
    const off = scales.filter((s) => s.off > TOLERANCE)
    expect(off.map((s) => `${s.shot} ${s.who}: ${s.min.toFixed(3)}..${s.max.toFixed(3)}`)).toEqual([])
  })
})
