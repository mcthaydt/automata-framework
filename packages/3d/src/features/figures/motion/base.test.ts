// Locomotion: base() against FigureBuilder's goldens, and the walk's own checks. Ported from FigureBuilder
// (mcthaydt/FigureBuilder) tests/form.test.ts "the walk" at a1f7246 and The Last Light
// (mcthaydt/PixiJS3D_Experiment_001) tests/procedural-figure.test.ts at 92e6704 ("plants both feet on the
// floor when standing", "walks a closed cycle"), onto AF's fixture figures. F-c and F-h are M3 spec §13's.

import { beforeAll, describe, expect, it } from 'vitest'
import { apply, invertRigid, type M, position, sub, type V3 } from '../../../shared/math/math.ts'
import { type FixtureFigures, fixtureFigures } from '../../../testing/fixture-library.ts'
import { GOLDEN_OUTFITS } from '../../../testing/golden-outfits.ts'
import { expectClose, expectDigest, MOTION_GOLDENS } from '../../../testing/motion-goldens.ts'
import { AT_REST, GOLDEN_SOME_STATES, GOLDEN_STATES } from '../../../testing/motion-states.ts'
import { randomCharacter, STREET_GAITS } from '../../../testing/random-character.ts'
import { at, J, type Side, type Skeleton } from '../body/rig.ts'
import type { Gait } from '../content/gait.schema.ts'
import type { FigureDef } from '../figure/figure.schema.ts'
import { type FigureBody, skeleton } from '../figure/figure-skeleton.ts'
import { base } from './base.ts'
import { poseClock } from './clock.ts'
import { gaitOf } from './gait-of.ts'
import { walkFoot } from './gait-path.ts'
import type { MotionState } from './motion-state.ts'

let fixture: FixtureFigures
beforeAll(async () => {
  fixture = await fixtureFigures()
})

const gaitNamed = (id: string): Gait => {
  const gait = fixture.gaits[id]
  if (!gait) throw new Error(`no gait ${id}`)
  return gait
}
const figure = (id: string): FigureDef => {
  const def = fixture.figures[id]
  if (!def) throw new Error(`no figure ${id}`)
  return def
}
/** The goldens' two bodies: Wick's and the keeper's sliders, as the golden outfits give them. */
const GOLDEN_BODIES: Readonly<Record<string, FigureBody>> = {
  wick: { sliders: at(GOLDEN_OUTFITS, 0).sliders },
  keeper: { sliders: at(GOLDEN_OUTFITS, 1).sliders },
}
const walking = (phase: number, extra: Partial<MotionState> = {}): MotionState => ({
  ...AT_REST,
  moving: true,
  phase,
  ...extra,
})
const expectWorldsClose = (a: readonly M[], b: readonly M[], what: string): void => {
  for (const [j, m] of a.entries())
    for (const [c, v] of m.entries()) expectClose(v, at(b, j)[c] ?? Number.NaN, `${what} joint ${j}`)
}
const rootSpace = (world: readonly M[], joint: number): V3 =>
  apply(invertRigid(at(world, J.root)), position(at(world, joint)))

describe("base() matches FigureBuilder's base() joint for joint (goldens, a1f7246)", () => {
  for (const [id, body] of Object.entries(GOLDEN_BODIES)) {
    it(`${id}: walk, idle and turn in every fixture gait`, () => {
      const s = skeleton(body)
      const goldens = MOTION_GOLDENS.bodies[id] ?? {}
      let compared = 0
      for (const [key, expected] of Object.entries(goldens)) {
        if (key.startsWith('stand ')) continue
        const gait = key.slice(0, key.indexOf(' '))
        const state = GOLDEN_STATES[key.slice(key.indexOf(' ') + 1)]
        if (!state) throw new Error(`no state for ${key}`)
        expectDigest(base(s, gaitNamed(gait), state).world, expected, `${id} ${key}`)
        compared++
      }
      // Seven gaits: the figure's own in all thirteen states, the other six in three each.
      expect(compared).toBe(Object.keys(GOLDEN_STATES).length + 6 * GOLDEN_SOME_STATES.length)
    })
  }
})

describe('standing and walking (The Last Light procedural-figure.test.ts, 92e6704)', () => {
  it('plants both feet on the floor when standing, for both figures', () => {
    for (const id of ['wick', 'keeper']) {
      const def = figure(id)
      const s = skeleton(def)
      const { world } = base(s, gaitOf(def, fixture.gaits), AT_REST)
      for (const side of ['L', 'R'] as const)
        expect(Math.abs(position(at(world, J[`foot.${side}`]))[1] - s.genes.ankle), side).toBeLessThan(0.02)
    }
  })
  it('walks a closed cycle: phase 0 and phase 1 are the same pose', () => {
    for (const id of ['wick', 'keeper']) {
      const def = figure(id)
      const s = skeleton(def)
      const gait = gaitOf(def, fixture.gaits)
      expectWorldsClose(base(s, gait, walking(0)).world, base(s, gait, walking(1)).world, id)
    }
  })
})

describe('the walk (FigureBuilder form.test.ts, a1f7246)', () => {
  // FigureBuilder's cast for this test walks the street gaits: bodies in the lookbook's ranges (the golden
  // outfits' model and tall bodies, seeded random characters) and the keeper in every one, Wick in his own.
  // Their knees at the strike are FigureBuilder's numbers (the goldens match): Wick's legs, a fifth of the
  // slider, bend 37° in the loose gait, and the elderly gait, not a street gait, shuffles on bent knees (38°).
  const cases = (): [string, FigureBody, readonly string[]][] => [
    ...GOLDEN_OUTFITS.filter((o) => o.name === 'model-nurse' || o.name === 'tall-hoodie').map(
      (o): [string, FigureBody, readonly string[]] => [o.name, { sliders: o.sliders }, STREET_GAITS],
    ),
    ...[...Array(10).keys()].map((i): [string, FigureBody, readonly string[]] => [
      `random ${2000 + i}`,
      randomCharacter(2000 + i, fixture.library).def,
      STREET_GAITS,
    ]),
    ['wick', figure('wick'), ['bounce']],
    ['keeper', figure('keeper'), STREET_GAITS],
  ]
  it('the head bobs a texel, a foot is always down, the trailing knee long at the strike', () => {
    for (const [name, body, gaits] of cases())
      for (const id of gaits) {
        const s = skeleton(body)
        const g = gaitNamed(id)
        const n = g.walkPoses
        const k = s.genes.height / 1.62
        const heads: number[] = []
        for (let i = 0; i < n; i++) {
          const what = `${name} ${id} frame ${i}`
          const world = base(s, g, walking(i / n)).world
          heads.push(position(at(world, J.head))[1])
          // The lower ankle on the floor (its own height over the sole, give or take the heel's roll).
          const ankles = (['L', 'R'] as const).map(
            (side) => position(at(world, J[`foot.${side}`]))[1] - s.genes.ankle,
          )
          expect(Math.min(...ankles), what).toBeLessThan(0.02 * k)
          expect(Math.min(...ankles), what).toBeGreaterThan(-0.005 * k)
          // At the strike (frames 0 and n/2) both knees run nearly straight: a step, not a lunge or a kneel.
          if (i % (n / 2) === 0)
            for (const side of ['L', 'R'] as const) {
              const hip = position(at(world, J[`thigh.${side}`]))
              const knee = position(at(world, J[`shin.${side}`]))
              const ankle = position(at(world, J[`foot.${side}`]))
              const a = sub(knee, hip)
              const b = sub(ankle, knee)
              const bend = Math.acos(
                (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / Math.hypot(...a) / Math.hypot(...b),
              )
              expect((bend * 180) / Math.PI, `${what} ${side} knee`).toBeLessThan(36)
            }
        }
        // A texel at the brand kit's density (36.9 per metre): no walk glides.
        expect(Math.max(...heads) - Math.min(...heads), `${name} ${id}`).toBeGreaterThanOrEqual(1 / 36.9)
      }
  })
})

describe('F-c: the walk repeats exactly after one cycle at the pose rate', () => {
  it('every walk pose of every fixture gait, from the pose clock', () => {
    for (const id of ['wick', 'keeper']) {
      const s = skeleton(figure(id))
      for (const [name, gait] of Object.entries(fixture.gaits)) {
        const n = gait.walkPoses
        const phases = new Set<number>()
        for (let i = 0; i < n; i++) {
          // Mid-step, five cycles in: then one cycle on.
          const time = 5 * gait.cycle + ((i + 0.5) * gait.cycle) / n
          const now = poseClock(gait, time)
          const later = poseClock(gait, time + gait.cycle)
          phases.add(now.phase)
          const state = (c: typeof now) => walking(c.phase, { t: c.t, yaw: 0.3 })
          expect(base(s, gait, state(later)).world, `${id} ${name} pose ${i}`).toEqual(
            base(s, gait, state(now)).world,
          )
        }
        // One pose a step: the cycle's n phases, each once.
        expect([...phases].sort(), `${id} ${name}`).toEqual([...Array(n).keys()].map((i) => i / n))
      }
    }
  })
  it("the twitch is idle's: a twitchy gait walks the same at a twitch's time as between twitches", () => {
    const s = skeleton(figure('keeper'))
    for (const name of ['elderly', 'uncanny']) {
      const gait = gaitNamed(name)
      expect(gait.twitch).toBeGreaterThan(0)
      expect(base(s, gait, walking(0.25, { t: 0 })).world, name).toEqual(
        base(s, gait, walking(0.25, { t: gait.twitchEvery / 2 })).world,
      )
      // Standing, it still twitches.
      expect(base(s, gait, { ...AT_REST, t: 0 }).world).not.toEqual(
        base(s, gait, { ...AT_REST, t: 1e-3 }).world,
      )
    }
  })
})

describe('F-h: moveDir turns the stride; a half-turn plays the cycle backwards', () => {
  /** The phases (of n) a foot is planted in, in the order it passes them: its stance, one run round the cycle. */
  const stance = (s: Skeleton, gait: Gait, side: Side, moveDir: number, n: number): number[] => {
    const planted = [...Array(n).keys()].map((i) => walkFoot(gait, s, side, i / n, moveDir).planted)
    const lifted = planted.indexOf(false)
    return [...Array(n).keys()].map((i) => (lifted + i) % n).filter((i) => planted[i])
  }
  const travelOf = (s: Skeleton, gait: Gait, side: Side, moveDir: number): V3 => {
    // The planted foot slides back under a body walking forward: travel is the opposite of its slide.
    const n = 96
    const run = stance(s, gait, side, moveDir, n)
    const first = walkFoot(gait, s, side, at(run, 0) / n, moveDir).at
    const last = walkFoot(gait, s, side, at(run, run.length - 1) / n, moveDir).at
    const slide = sub(first, last)
    const length = Math.hypot(slide[0], slide[2])
    return [slide[0] / length, 0, slide[2] / length]
  }
  it('the stride vector is the forward vector turned by moveDir (0, π/2, π)', () => {
    for (const id of ['wick', 'keeper']) {
      const def = figure(id)
      const s = skeleton(def)
      const gait = gaitOf(def, fixture.gaits)
      for (const moveDir of [0, Math.PI / 2, Math.PI]) {
        const travel = travelOf(s, gait, 'L', moveDir)
        const want: V3 = [Math.sin(moveDir), 0, Math.cos(moveDir)]
        for (const c of [0, 2] as const) expectClose(travel[c], want[c], `${id} moveDir ${moveDir} axis ${c}`)
      }
    }
  })
  it("the evaluated feet follow the paths: a strafe's planted foot slides along the body's x axis", () => {
    const def = figure('wick')
    const s = skeleton(def)
    const gait = gaitOf(def, fixture.gaits)
    const n = 32
    const planted = stance(s, gait, 'L', Math.PI / 2, n)
    expect(planted.length).toBeGreaterThan(4)
    const ankle = (i: number) =>
      rootSpace(base(s, gait, walking(i / n, { moveDir: Math.PI / 2, yaw: 0.7 })).world, J['foot.L'])
    const slide = sub(ankle(at(planted, planted.length - 1)), ankle(at(planted, 0)))
    // Toward the figure's right (−x) for travel to its left: along x, none along z.
    expect(slide[0]).toBeLessThan(-0.05)
    expect(Math.abs(slide[2])).toBeLessThan(1e-6)
  })
  it('a half-turn is the forward walk played backwards: the pose at p is the forward pose at 1 − p', () => {
    for (const id of ['wick', 'keeper']) {
      const def = figure(id)
      const s = skeleton(def)
      const gait = gaitOf(def, fixture.gaits)
      for (let i = 0; i < 16; i++) {
        const p = i / 16
        const back = base(s, gait, walking(p, { moveDir: Math.PI, yaw: 0.4 })).world
        const forward = base(s, gait, walking(p === 0 ? 0 : 1 - p, { yaw: 0.4 })).world
        expectWorldsClose(back, forward, `${id} phase ${p}`)
      }
    }
  })
  it('moveDir 0 is the walk with no moveDir', () => {
    const def = figure('keeper')
    const s = skeleton(def)
    const gait = gaitOf(def, fixture.gaits)
    for (const p of [0, 0.2, 0.6])
      expect(base(s, gait, walking(p, { moveDir: 0 })).world).toEqual(base(s, gait, walking(p)).world)
  })
})

describe('the hems hang between hip and ankle along the line of travel', () => {
  it('on the floor or with the lifted ankle, at the ankle across the line, between the hip and the ankle along it', () => {
    const def = figure('keeper')
    const s = skeleton(def)
    const gait = gaitOf(def, fixture.gaits)
    for (const moveDir of [0, Math.PI / 2, -Math.PI / 3]) {
      const line: V3 = [Math.sin(moveDir), 0, Math.cos(moveDir)]
      const across: V3 = [line[2], 0, -line[0]]
      const dotXZ = (a: V3, b: V3) => a[0] * b[0] + a[2] * b[2]
      for (let i = 0; i < 16; i++) {
        const world = base(s, gait, walking(i / 16, { moveDir, yaw: 0.9 })).world
        for (const side of ['L', 'R'] as const) {
          const what = `moveDir ${moveDir.toFixed(3)} phase ${i}/16 ${side}`
          const hem = rootSpace(world, J[`hem${side}`])
          const ankle = rootSpace(world, J[`foot.${side}`])
          const hip = rootSpace(world, J[`thigh.${side}`])
          expect(Math.abs(hem[1] - Math.max(ankle[1], s.genes.ankle)), what).toBeLessThan(1e-9)
          expect(Math.abs(dotXZ(sub(hem, ankle), across)), what).toBeLessThan(1e-9)
          const along = dotXZ(hem, line)
          const ends = [dotXZ(hip, line), dotXZ(ankle, line)]
          expect(along, what).toBeGreaterThanOrEqual(Math.min(...ends) - 1e-9)
          expect(along, what).toBeLessThanOrEqual(Math.max(...ends) + 1e-9)
        }
      }
    }
  })
})
