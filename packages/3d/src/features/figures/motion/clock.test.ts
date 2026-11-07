// The pose clock, the turn on the spot and the head's lead (FigureBuilder figure.ts `Figure.update` and
// `Figure.motion` at a1f7246, as pure functions of presentation time).

import { beforeAll, describe, expect, it } from 'vitest'
import { fixtureFigures } from '../../../testing/fixture-library.ts'
import type { Gait } from '../content/gait.schema.ts'
import { headLead, poseClock, shufflePhase, turnStep, wrapAngle } from './clock.ts'

let gaits: Readonly<Record<string, Gait>>
beforeAll(async () => {
  gaits = (await fixtureFigures()).gaits
})
const gait = (id: string): Gait => {
  const g = gaits[id]
  if (!g) throw new Error(`no gait ${id}`)
  return g
}

describe('poseClock', () => {
  it('steps the walk at walkPoses a cycle', () => {
    const g = gait('brisk')
    const step = g.cycle / g.walkPoses
    expect(poseClock(g, 0).phase).toBe(0)
    expect(poseClock(g, step * 0.99).phase).toBe(0)
    expect(poseClock(g, step * 1.01).phase).toBe(1 / g.walkPoses)
    expect(poseClock(g, g.cycle * 3 + step * 2.5).phase).toBe(2 / g.walkPoses)
  })
  it('holds an idle of idlePoses across its loop, and loops it', () => {
    const g = gait('uncanny')
    const loop = g.idleLoop ?? 0
    const held = loop / (g.idlePoses ?? 1)
    expect(poseClock(g, held * 0.5).t).toBe(0)
    expect(poseClock(g, held * 1.5).t).toBe(held)
    expect(poseClock(g, loop + held * 1.5).t).toBe(poseClock(g, held * 1.5).t)
  })
  it('holds the idle still while the figure turns on the spot (FigureBuilder figure.ts: idleT = still ? 0 : steppedT)', () => {
    const g = gait('brisk')
    expect(poseClock(g, 2.3, { still: true }).t).toBe(0)
    expect(poseClock(g, 2.3, { still: false }).t).toBe(poseClock(g, 2.3).t)
    // The walk and the beat keep their time.
    expect(poseClock(g, 2.3, { still: true }).phase).toBe(poseClock(g, 2.3).phase)
    expect(poseClock(g, 2.3, { still: true }).step).toBe(poseClock(g, 2.3).step)
  })
  it('steps an idle with no loop at the pose rate', () => {
    const g = gait('elderly')
    expect(g.idleLoop).toBeUndefined()
    expect(poseClock(g, 2.3).t).toBe(Math.floor(2.3 * g.poseRate) / g.poseRate)
    expect(poseClock(g, 2.3).step).toBe(Math.floor(2.3 * g.poseRate))
  })
})

describe('the turn on the spot', () => {
  it('turns at most turnRate a pose step, the short way round, and lands on the facing', () => {
    const g = gait('brisk')
    expect(turnStep(g, 0, 1)).toBeCloseTo(g.turnRate, 12)
    expect(turnStep(g, 0, -1)).toBeCloseTo(-g.turnRate, 12)
    // From just short of a half-turn the other way: the short way is negative.
    expect(turnStep(g, 0.2, 0.2 - 3)).toBeCloseTo(0.2 - g.turnRate, 12)
    expect(turnStep(g, 1, 1 + g.turnRate / 2)).toBe(1 + g.turnRate / 2)
    let shown = 0
    for (let i = 0; i < 100 && shown !== 2; i++) shown = turnStep(g, shown, 2)
    expect(shown).toBe(2)
  })
  it('leads with the head, at most headLead either way', () => {
    const g = gait('brisk')
    expect(headLead(g, 0, 0.1)).toBeCloseTo(Math.min(0.1, g.headLead), 12)
    expect(headLead(g, 0, 3)).toBe(g.headLead)
    expect(headLead(g, 0, -3)).toBe(-g.headLead)
    expect(headLead(g, 0, 0)).toBe(0)
  })
  it('shuffles in four beats while turning, unless the gait pivots', () => {
    const g = gait('brisk')
    const clock = poseClock(g, 7 / g.poseRate)
    expect(shufflePhase(g, clock, true, false)).toBe(0.75)
    expect(shufflePhase(g, clock, false, false)).toBe(0)
    expect(shufflePhase(g, clock, true, true)).toBe(0)
    expect(shufflePhase(gait('uncanny'), clock, true, false)).toBe(0)
  })
  it('wraps angles to [−π, π)', () => {
    expect(wrapAngle(Math.PI * 3 + 0.5)).toBeCloseTo(-Math.PI + 0.5, 12)
    expect(wrapAngle(-0.25)).toBeCloseTo(-0.25, 15)
  })
})
