// Shake and sparks (DESIGN.md §7.6): presentation from `hit.landed`, never read by the sim.
import { Q16 } from '@mcthaydt/automata-render-pixi3d/sim'
import type { StepResult } from '@mcthaydt/automata-sim'
import { describe, expect, it } from 'vitest'
import { type FeltHit, feltEvents, SHAKE_MS, SPARK_COLOURS, shakeOffset, sparkFrame } from './feel.ts'

const hit = (power: number, startMs = 0, kind: FeltHit['kind'] = 'hit'): FeltHit => ({
  power,
  kind,
  at: { x: 0, z: 0 },
  startMs,
})
const size = (offset: { x: number; y: number }) => Math.max(Math.abs(offset.x), Math.abs(offset.y))

describe('shakeOffset', () => {
  it('shakes 1, 2 and 4 internal pixels for power 1, 2 and 3 as the hit lands', () => {
    expect(size(shakeOffset([hit(1)], 0, false))).toBe(1)
    expect(size(shakeOffset([hit(2)], 0, false))).toBe(2)
    expect(size(shakeOffset([hit(3)], 0, false))).toBe(4)
  })

  it('takes the largest live shake, decays it and stops at 120 ms', () => {
    expect(size(shakeOffset([hit(1), hit(3)], 0, false))).toBe(4)
    expect(size(shakeOffset([hit(3)], SHAKE_MS / 2, false))).toBeCloseTo(2, 5)
    expect(shakeOffset([hit(3)], SHAKE_MS, false)).toEqual({ x: 0, y: 0 })
  })

  it('does not shake under reduced motion', () => {
    expect(shakeOffset([hit(3)], 0, true)).toEqual({ x: 0, y: 0 })
  })
})

describe('sparkFrame', () => {
  it('spreads and fades over 150 ms, in the kind’s colour', () => {
    expect(sparkFrame(hit(1), 0, false)).toEqual({ spread: 0, alpha: 1, colour: SPARK_COLOURS.hit })
    expect(sparkFrame(hit(1), 75, false)).toMatchObject({ alpha: 0.5 })
    expect(sparkFrame(hit(1), 150, false)).toBeUndefined()
    expect(sparkFrame(hit(1, 0, 'parry'), 0, false)?.colour).toBe(SPARK_COLOURS.parry)
  })

  it('is shortened to 75 ms under reduced motion', () => {
    expect(sparkFrame(hit(1), 74, true)).toBeDefined()
    expect(sparkFrame(hit(1), 75, true)).toBeUndefined()
  })
})

describe('feltEvents (GAME-3D.1d part 4: the ash burst)', () => {
  const step = (events: { type: string; payload: unknown }[]) => ({ events }) as unknown as StepResult
  it('feels a hit as its sparks and shake, and a beaten foe as a burst of ash with no shake, where it fell', () => {
    const felt = feltEvents(
      step([
        {
          type: 'hit.landed',
          payload: { attacker: 1, target: 2, kind: 'parry', power: 2, x: Q16, z: 2 * Q16 },
        },
        { type: 'foe.defeated', payload: { target: 2, x: 3 * Q16, z: -Q16 } },
        { type: 'drop.taken', payload: { kind: 1, amount: 1, x: 0, z: 0 } },
      ]),
      40,
    )
    expect(felt).toEqual([
      { power: 2, kind: 'parry', at: { x: 1, z: 2 }, startMs: 40 },
      { power: 0, kind: 'ash', at: { x: 3, z: -1 }, startMs: 40 },
    ])
    expect(shakeOffset([felt[1] as FeltHit], 40, false)).toEqual({ x: 0, y: 0 })
    expect(sparkFrame(felt[1] as FeltHit, 40, false)?.colour).toBe(SPARK_COLOURS.ash)
  })
})
