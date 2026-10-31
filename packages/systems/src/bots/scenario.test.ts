// Scenarios (M6 spec §4.6, §13 SY-b) on the ward scene: a scenario's setup is applied, its actions are the bot's plan,
// its condition is checked over its declared seeds, and the result is the same in every run.
import { describe, expect, it } from 'vitest'
import { wardScene } from '../testing/ward-scene'
import { createBot } from './bot'
import { claimsCheck, play, runScenario, stepsFor } from './index'

describe('a scenario', () => {
  it('turns its actions into a plan: an action, a floor verb at a node, a hiding place', () => {
    const scene = wardScene()
    expect(stepsFor(scene, ['desk.key', 'floor.bottle@cmid', 'hide:locker'])).toEqual([
      { action: 'desk.key', at: 'desk' },
      { action: 'floor.bottle', at: 'floor', held: 'bottle', point: { x: 0.3, z: -4 } },
      { action: 'hide:locker', at: 'locker' },
    ])
    expect(() => stepsFor(scene, ['nowhere'])).toThrow(/no action nowhere/)
  })

  it('lures the watchman with a bottle over its declared seeds, and claims its systemic', async () => {
    const scene = wardScene()
    const lure = scene.def.scenarios.find((s) => s.id === 'bottleLure')
    if (lure === undefined) throw new Error('no bottleLure')
    const result = await runScenario(scene, lure)
    expect(result).toMatchObject({
      id: 'bottleLure',
      claims: 'watchmanLured',
      seeds: 4,
      successes: 4,
      probability: 1,
      ok: true,
    })
    expect(result.times.every((t) => t !== null && t > 0 && t <= lure.expect.within)).toBe(true)
    expect(claimsCheck(scene, [result])).toEqual([
      { id: 'claim:watchmanLured', ok: true, detail: 'bottleLure passes (4/4)' },
    ])
    expect(claimsCheck(scene, [])).toEqual([
      { id: 'claim:watchmanLured', ok: false, detail: 'no scenario claims it' },
    ])
  })

  it('gives the same probability, times and deaths in every run (SY-b)', async () => {
    const scene = wardScene()
    const caught = scene.def.scenarios.find((s) => s.id === 'seenInCorridor')
    if (caught === undefined) throw new Error('no seenInCorridor')
    const first = await runScenario(scene, caught)
    const second = await runScenario(scene, caught)
    expect(second).toEqual(first)
    expect(first.deaths).toBeGreaterThanOrEqual(0)
  })
})

describe('a run', () => {
  it('wins the ward on its route with the watchman on, and measures the run', async () => {
    const scene = wardScene()
    const route = scene.routes[0]
    if (route === undefined) throw new Error('no route')
    const bot = createBot('scripted', { player: scene.player, seed: 1, plan: route.plan })
    const run = await play(scene, { bot, seed: 1, limit: 60 })
    expect(run.outcome).toBe('win')
    expect(run.skeleton).toEqual(['desk', 'exit:key'])
    expect(run.time).toBeGreaterThan(0)
    expect(Object.keys(run.modes).sort()).toContain('patrol')
  })
})
