import { beforeAll, describe, expect, it } from 'vitest'
import type { FigureClipDef } from '../clip/clip.schema'
import { apply, invertRigid, type M } from '../math/math'
import { poseClock } from '../motion/clock'
import { gaitOf } from '../motion/gait-of'
import { evaluateMotion, holdOf } from '../motion/hold'
import type { MotionState } from '../motion/motion-state'
import { at, J, JOINTS, type Joint } from '../rig/rig'
import { type FixtureMotion, fixtureMotion } from '../testing/fixture-motion'
import { random } from '../testing/random-character'
import { evaluate } from './evaluate'
import type { FigureState, MotionLibrary } from './figure-state'

let fixture: FixtureMotion
beforeAll(async () => {
  fixture = await fixtureMotion()
})

const STILL: FigureState = { moving: false, speed: 0, facing: 0 }
const WALKING: FigureState = { moving: true, speed: 1.2, facing: 0.4 }
const position = (m: M) => apply(m, [0, 0, 0])
const maxDiff = (a: readonly M[], b: readonly M[], joints: readonly Joint[]) => {
  let worst = 0
  for (const joint of joints)
    for (let i = 0; i < 12; i++)
      worst = Math.max(worst, Math.abs((at(a, J[joint])[i] ?? 0) - (at(b, J[joint])[i] ?? 0)))
  return worst
}
const LEGS: Joint[] = ['thigh.L', 'shin.L', 'foot.L', 'thigh.R', 'shin.R', 'foot.R']
const ARM_L: Joint[] = ['clavicle.L', 'upperArm.L', 'foreArm.L', 'hand.L']
const withClip = (library: MotionLibrary, id: string, clip: FigureClipDef): MotionLibrary => ({
  ...library,
  clips: { ...library.clips, [id]: clip },
})

/** The locomotion `evaluate` plays for `state` at `time`, through M3.5c's `evaluateMotion`. */
function locomotion(state: FigureState, time: number, extra: Partial<MotionState> = {}) {
  const { body, wick, library } = fixture
  const gait = gaitOf(wick, library.gaits)
  const clock = poseClock(gait, time)
  return evaluateMotion(body, gait, {
    t: clock.t,
    moving: state.moving,
    phase: clock.phase,
    yaw: state.facing,
    headYaw: 0,
    shuffle: 0,
    moveDir: state.moveDir,
    ...extra,
  })
}

describe('evaluate: locomotion only', () => {
  it('is the locomotion when no clip plays, standing and walking', () => {
    const { body, wick, library } = fixture
    for (const [state, time] of [
      [STILL, 0.7],
      [WALKING, 0.35],
      [{ ...WALKING, moveDir: Math.PI / 2 }, 1.1],
    ] as const) {
      const out = evaluate(body, wick, state, time, library)
      expect(maxDiff(out.world, locomotion(state, time).world, JOINTS)).toBeLessThan(1e-12)
    }
  })
  it('holds the item in the figure’s hand, as evaluateMotion does', () => {
    const { body, wick, library } = fixture
    const item = library.items['hand-lamp']
    if (!item) throw new Error('no hand-lamp')
    const out = evaluate(body, wick, { ...WALKING, item: 'hand-lamp' }, 0.35, library)
    const expected = locomotion(WALKING, 0.35, { hold: holdOf(item, body, wick.hand) })
    expect(maxDiff(out.world, expected.world, JOINTS)).toBeLessThan(1e-12)
  })
})

describe('I-g: the same state gives the same pose', () => {
  it('gives equal matrices at 1,000 seeded times, with a stance, an action and an aim', () => {
    const { body, wick, library } = fixture
    const next = random(36)
    for (let i = 0; i < 1000; i++) {
      const time = next() * 4
      const state: FigureState = {
        ...WALKING,
        stances: [{ id: 'raise-guard', startedAt: 0 }],
        action: { id: 'slash', startedAt: time - next() * 0.6 },
        aim: [{ part: 'head', at: [1, 1.2, 2] }],
      }
      const a = evaluate(body, wick, state, time, library)
      const b = evaluate(body, wick, state, time, library)
      expect(b.world).toEqual(a.world)
    }
  })
  it('a loop clip’s value at 0 equals its value at its length', () => {
    const { body, wick, library } = fixture
    const sway: FigureClipDef = {
      length: 0.5,
      loop: 'loop',
      mask: ['torso'],
      keys: [
        { t: 0, pose: { effectors: { chest: { rot: [0, -10, 0] } } } },
        { t: 0.25, pose: { effectors: { chest: { rot: [0, 10, 0] } } } },
        { t: 0.5, pose: { effectors: { chest: { rot: [0, -10, 0] } } } },
      ],
    }
    const lib = withClip(library, 'sway', sway)
    // At one presentation time, so the locomotion under it is the same: 0 and 0.5 s into the clip.
    const at = (startedAt: number) =>
      evaluate(body, wick, { ...STILL, stances: [{ id: 'sway', startedAt }] }, 0.3, lib, { smooth: true })
        .world
    expect(at(-0.2)).toEqual(at(0.3))
  })
})

describe('I-h: masks', () => {
  it('a clip masked to the right arm and the torso changes no joint of the legs or the left arm', () => {
    const { body, wick, library } = fixture
    const hand: FigureClipDef = {
      length: 0.4,
      loop: 'hold',
      mask: ['armR', 'torso'],
      keys: [
        { t: 0, pose: 'free' },
        { t: 0.4, pose: { effectors: { handR: { pos: [-0.16, 1.3, 0.5] } } } },
      ],
    }
    const lib = withClip(library, 'hand', hand)
    for (const state of [STILL, WALKING]) {
      const without = evaluate(body, wick, state, 0.3, lib)
      const withIt = evaluate(body, wick, { ...state, action: { id: 'hand', startedAt: 0 } }, 0.3, lib)
      expect(maxDiff(withIt.world, without.world, [...LEGS, ...ARM_L])).toBeLessThan(1e-9)
      expect(maxDiff(withIt.world, without.world, ['hand.R'])).toBeGreaterThan(1e-3)
    }
  })
  it('a clip that turns the chest leaves the legs and the left arm’s own turns, and a left-hand item holds', () => {
    const { body, library } = fixture
    const leftHanded = { ...fixture.wick, hand: 'L' as const }
    const state: FigureState = { ...WALKING, item: 'hand-lamp' }
    const without = evaluate(body, leftHanded, state, 0.3, library)
    const jab = evaluate(body, leftHanded, { ...state, action: { id: 'jab', startedAt: 0.1 } }, 0.3, library)
    expect(maxDiff(jab.world, without.world, LEGS)).toBeLessThan(1e-9)
    for (const joint of ARM_L.slice(1)) {
      const a = at(jab.pose.rot, J[joint])
      const b = at(without.pose.rot, J[joint])
      expect(Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])).toBeCloseTo(1, 9)
    }
    // The lamp's hand keeps its place in the chest's space, where its hold puts it.
    const handInChest = (world: readonly M[]) =>
      apply(invertRigid(at(world, J.chest)), position(at(world, J['hand.L'])))
    const held = handInChest(without.world)
    handInChest(jab.world).forEach((v, i) => {
      expect(v).toBeCloseTo(held[i] ?? 0, 9)
    })
  })
  it('does not hold an item on an arm a clip owns', () => {
    const { body, wick, library } = fixture
    const state: FigureState = { ...STILL, item: 'hand-lamp', action: { id: 'jab', startedAt: 0 } }
    const held = evaluate(body, wick, state, 0.25, library)
    const bare = evaluate(body, wick, { ...state, item: undefined }, 0.25, library)
    expect(held.world).toEqual(bare.world)
  })
})

describe('stances and the action', () => {
  it('layers the action over a stance on the channels both own', () => {
    const { body, wick, library } = fixture
    const guard: FigureState = { ...STILL, stances: [{ id: 'raise-guard', startedAt: 0 }] }
    const guarded = evaluate(body, wick, guard, 1, library)
    const jabbing = evaluate(body, wick, { ...guard, action: { id: 'jab', startedAt: 0.75 } }, 1, library)
    // The jab owns the right arm at its contact; the guard keeps the left.
    expect(maxDiff(jabbing.world, guarded.world, ['hand.R'])).toBeGreaterThan(1e-2)
    expect(jabbing.report.reached.handR?.ok).toBe(true)
  })
  it('ramps a stance out after the sim lowers it, then plays the locomotion', () => {
    const { body, wick, library } = fixture
    const lowered = (time: number) =>
      evaluate(
        body,
        wick,
        { ...STILL, stances: [{ id: 'raise-guard', startedAt: 0, endedAt: 1 }] },
        time,
        library,
      )
    const plain = evaluate(body, wick, STILL, 1.2, library)
    expect(maxDiff(lowered(1.06).world, plain.world, ['hand.R'])).toBeGreaterThan(1e-3)
    expect(maxDiff(lowered(1.2).world, plain.world, JOINTS)).toBeLessThan(1e-12)
  })
  it('a once action ends at its length and the locomotion plays again', () => {
    const { body, wick, library } = fixture
    const after = evaluate(body, wick, { ...STILL, action: { id: 'jab', startedAt: 0 } }, 0.5, library)
    expect(maxDiff(after.world, evaluate(body, wick, STILL, 0.5, library).world, JOINTS)).toBeLessThan(1e-12)
  })
  it('retimes the action to the length the sim gives', () => {
    const { body, wick, library } = fixture
    // At one presentation time: 0.25 s into the jab as authored, and 0.5 s into it stretched to twice its length.
    const authored = evaluate(
      body,
      wick,
      { ...STILL, action: { id: 'jab', startedAt: 0.25 } },
      0.5,
      library,
      {
        smooth: true,
      },
    )
    const stretched = evaluate(
      body,
      wick,
      { ...STILL, action: { id: 'jab', startedAt: 0, length: 0.8 } },
      0.5,
      library,
      {
        smooth: true,
      },
    )
    expect(maxDiff(stretched.world, authored.world, JOINTS)).toBeLessThan(1e-12)
  })
})

describe('missing clips, aim and pins', () => {
  it('warns once per missing clip id and keeps the locomotion', () => {
    const { body, wick, library } = fixture
    const told: string[] = []
    const options = { warn: (message: string) => told.push(message), warned: new Set<string>() }
    const state = { ...STILL, action: { id: 'nope', startedAt: 0 } }
    const out = evaluate(body, wick, state, 0.2, library, options)
    evaluate(body, wick, state, 0.3, library, options)
    expect(told).toEqual(['figure: no figure-clip has the id nope; the figure keeps its locomotion'])
    expect(maxDiff(out.world, evaluate(body, wick, STILL, 0.2, library).world, JOINTS)).toBeLessThan(1e-12)
  })
  it('aims the head over a clip and holds a pinned foot', () => {
    const { body, wick, library } = fixture
    const pinned = position(at(evaluate(body, wick, STILL, 0, library).world, J['foot.L']))
    const state: FigureState = {
      ...STILL,
      action: { id: 'flinch', startedAt: 0 },
      aim: [{ part: 'head', at: [1.5, 1, 2] }],
      pins: { footL: [pinned[0], pinned[1], pinned[2]] },
    }
    const out = evaluate(body, wick, state, 0.5, library)
    expect(out.report.reached.aim?.ok).toBe(true)
    const foot = position(at(out.world, J['foot.L']))
    for (let i = 0; i < 3; i++) expect(Math.abs((foot[i] ?? 0) - (pinned[i] ?? 0))).toBeLessThan(1e-6)
  })
})
