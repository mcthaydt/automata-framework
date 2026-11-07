// The cutscene plugin (M6.9a step 3, M6 spec §4.8, M6-D7): a cutscene is sim ticks. It starts as an event, holds input
// until its end tick or a skip, and a script whose anchor is missing is not played. CS-a, CS-b, CS-c.
import { describe, expect, it } from 'vitest'
import { createCutGame, heard, hit, hits, load, play, skip, step } from '../testing/cut-game'
import type { CutsceneScript } from './cutscene.schema'

const script = (
  id: string,
  duration: number,
  actor: CutsceneScript['actor'] = undefined,
): CutsceneScript => ({
  id,
  duration,
  camera: [{ t: 0, pos: [0, 1.6, 4], look: [0, 1.2, 0] }],
  actor,
})
const THREE = script('three', 3)
const NURSE = script('nurse', 2, [{ who: 'nurse', t: 0, at: 'actor:nurse' }])

async function started(scripts = [THREE, NURSE], options = {}) {
  const { sim, cutscenes } = await createCutGame(scripts, options)
  step(sim, load())
  return { sim, cutscenes }
}

describe('CS-a: a cutscene is its duration in ticks', () => {
  it('3 s at 60 Hz starts at a tick and ends 180 ticks later; input is ignored in between and resumes', async () => {
    const { sim } = await started()
    const at = sim.tick
    expect(heard(step(sim, play('three')))).toEqual([
      ['cutscene.started', { id: 'three', start: at, end: at + 180 }],
    ])
    let ended = -1
    for (let i = 1; i <= 200; i++) {
      const result = step(sim, hit())
      if (heard(result).some(([type]) => type === 'cutscene.ended')) {
        ended = sim.tick - 1
        break
      }
    }
    expect(ended).toBe(at + 180)
    // Every hit sent while it played was ignored; the ending step's own is the first to count.
    expect(hits(sim)).toBeLessThanOrEqual(1)
    step(sim, hit())
    expect(hits(sim)).toBeGreaterThanOrEqual(1)
  })
  it('the same run twice ends on the same hash', async () => {
    const run = async () => {
      const { sim } = await started()
      step(sim, play('three'))
      for (let i = 0; i < 200; i++) step(sim, hit())
      return sim.hash()
    }
    expect(await run()).toBe(await run())
  })
})

describe('CS-b: cutscene.skip ends it on the next tick and resumes input', () => {
  it('skipped at tick 30 of the cutscene', async () => {
    const { sim } = await started()
    const at = sim.tick
    step(sim, play('three'))
    while (sim.tick < at + 30) step(sim, hit())
    expect(hits(sim)).toBe(0)
    const result = step(sim, skip())
    expect(heard(result)).toEqual([['cutscene.ended', { id: 'three', skipped: true, missing: [] }]])
    step(sim, hit())
    expect(hits(sim)).toBe(1)
  })
  it('a skip with no cutscene playing does nothing', async () => {
    const { sim } = await started()
    expect(heard(step(sim, skip()))).toEqual([])
  })
})

describe('CS-c: a cutscene whose anchor is absent is skipped, and input is not locked', () => {
  it('ends at once, naming the anchor', async () => {
    const { sim } = await started()
    expect(heard(step(sim, play('nurse')))).toEqual([
      ['cutscene.ended', { id: 'nurse', skipped: true, missing: ['actor:nurse'] }],
    ])
    step(sim, hit())
    expect(hits(sim)).toBe(1)
  })
  it('plays when the game can resolve the anchor', async () => {
    const { sim } = await started([THREE, NURSE], {
      anchor: (_ctx: unknown, name: string) => (name === 'actor:nurse' ? { x: 1, z: 2 } : undefined),
    })
    expect(heard(step(sim, play('nurse')))[0]).toMatchObject(['cutscene.started', { id: 'nurse' }])
  })
})

describe('starting', () => {
  it('ignores an id the scene does not have', async () => {
    const { sim } = await started()
    expect(heard(step(sim, play('nope')))).toEqual([])
    step(sim, hit())
    expect(hits(sim)).toBe(1)
  })
  it('replaces a cutscene under way: the old one ends skipped, the new one starts (CS-D5)', async () => {
    const { sim } = await started()
    step(sim, play('three'))
    const events = heard(step(sim, play('three')))
    expect(events.map(([type]) => type)).toEqual(['cutscene.ended', 'cutscene.started'])
  })
  it('survives a snapshot: a cutscene under way restores to the same end', async () => {
    const { sim } = await started()
    step(sim, play('three'))
    for (let i = 0; i < 50; i++) step(sim, hit())
    const bytes = sim.snapshot()
    const other = await started()
    other.sim.restore(bytes)
    let a = -1
    let b = -1
    for (let i = 0; i < 200 && (a < 0 || b < 0); i++) {
      if (a < 0 && heard(step(sim)).length > 0) a = sim.tick
      if (b < 0 && heard(step(other.sim)).length > 0) b = other.sim.tick
    }
    expect(a).toBe(b)
    expect(sim.hash()).toBe(other.sim.hash())
  })
})
