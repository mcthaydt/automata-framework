// I-k (M3 spec §13): a new action replacing a running one does not pop. At the replacement the hand is where the
// outgoing clip had it, after the new clip's `blend.inMs` it is the new clip's own sample, and in between no frame
// moves it further than either clip moves it in one of its own pose steps.

import { beforeAll, describe, expect, it } from 'vitest'
import { apply, type M } from '../math/math'
import { at, J } from '../rig/rig'
import { type FixtureMotion, fixtureMotion } from '../testing/fixture-motion'
import { evaluate } from './evaluate'
import type { FigureState } from './figure-state'

let fixture: FixtureMotion
beforeAll(async () => {
  fixture = await fixtureMotion()
})

const STILL: FigureState = { moving: false, speed: 0, facing: 0 }
const FRAME = 1 / 60
const hand = (world: readonly M[], side: 'L' | 'R') => apply(at(world, J[`hand.${side}`]), [0, 0, 0])
const distance = (a: readonly number[], b: readonly number[]) =>
  Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0))

/** The hand on `side` at `time` for `state`, under a still locomotion. */
function handAt(state: FigureState, time: number, side: 'L' | 'R') {
  const { body, wick, library } = fixture
  return hand(evaluate(body, wick, state, time, library).world, side)
}

/** The largest move of the hand from one pose step of `id` to the next, the clip playing alone from 0. */
function largestStep(id: string, side: 'L' | 'R'): number {
  const clip = fixture.library.clips[id]
  if (!clip) throw new Error(`no clip ${id}`)
  const rate = clip.rate ?? 12
  let worst = 0
  let last = handAt({ ...STILL, action: { id, startedAt: 0 } }, 0, side)
  for (let step = 1; step <= Math.ceil(clip.length * rate) + 2; step++) {
    const next = handAt({ ...STILL, action: { id, startedAt: 0 } }, step / rate, side)
    worst = Math.max(worst, distance(last, next))
    last = next
  }
  return worst
}

describe.each([
  { outgoing: 'slash', incoming: 'slash', at: 0.2, side: 'R' as const, inMs: 80 },
  { outgoing: 'roll', incoming: 'raise-guard', at: 0.3, side: 'L' as const, inMs: 120 },
  // Cut into while it ramps in (120 ms), half shown.
  { outgoing: 'raise-guard', incoming: 'jab', at: 0.06, side: 'R' as const, inMs: 80 },
])('I-k: $outgoing replaced by $incoming', ({ outgoing, incoming, at: replacedAt, side, inMs }) => {
  const state: FigureState = {
    ...STILL,
    action: { id: incoming, startedAt: replacedAt, replaced: { id: outgoing, startedAt: 0 } },
  }
  it('starts on the outgoing pose', () => {
    const before = handAt({ ...STILL, action: { id: outgoing, startedAt: 0 } }, replacedAt, side)
    expect(distance(handAt(state, replacedAt, side), before)).toBeLessThan(1e-6)
  })
  it('is the new clip’s own sample once its blend is over', () => {
    const end = replacedAt + inMs / 1000
    const alone = handAt({ ...STILL, action: { id: incoming, startedAt: replacedAt } }, end, side)
    expect(distance(handAt(state, end, side), alone)).toBeLessThan(1e-6)
  })
  it('moves the hand no further a frame than either clip does a step', () => {
    const bound = Math.max(largestStep(outgoing, side), largestStep(incoming, side))
    let last = handAt(state, replacedAt, side)
    for (let time = replacedAt + FRAME; time <= replacedAt + inMs / 1000 + FRAME; time += FRAME) {
      const next = handAt(state, time, side)
      expect(distance(last, next)).toBeLessThanOrEqual(bound)
      last = next
    }
  })
})

describe('a transition of 0 ms', () => {
  it('cuts straight to the new clip', () => {
    const { body, wick, library } = fixture
    const jab = library.clips.jab
    if (!jab) throw new Error('no jab')
    const cutting = { ...library, clips: { ...library.clips, cut: { ...jab, blend: { inMs: 0, outMs: 0 } } } }
    const state: FigureState = {
      ...STILL,
      action: { id: 'cut', startedAt: 0.2, replaced: { id: 'slash', startedAt: 0 } },
    }
    const alone: FigureState = { ...STILL, action: { id: 'cut', startedAt: 0.2 } }
    expect(evaluate(body, wick, state, 0.2, cutting).world).toEqual(
      evaluate(body, wick, alone, 0.2, cutting).world,
    )
  })
})
