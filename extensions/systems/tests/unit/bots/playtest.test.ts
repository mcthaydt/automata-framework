// Playtests and sweeps on the ward scene: every route for each policy and seed, rated by fairness; a
// sweep rates the scene at each value of a tunable through the scene's `retune`.
import { describe, expect, it } from 'vitest'
import { fairness, playtest, sweep } from '#src/entries/bots.ts'
import { wardScene } from '#src/testing/ward-scene.ts'

describe('playtest', () => {
  it('the scripted bot wins the ward on its route with the watchman on, over 3 seeds', async () => {
    const report = await playtest(wardScene(), { seeds: 3, policies: ['scripted'] })
    expect(report.runs.map((r) => [r.route, r.policy, r.seed, r.outcome])).toEqual([
      ['key', 'scripted', 1, 'win'],
      ['key', 'scripted', 2, 'win'],
      ['key', 'scripted', 3, 'win'],
    ])
    expect(report.runs.every((r) => r.skeleton.join(' ') === 'desk exit:key')).toBe(true)
    expect(report.scenarios.map((s) => [s.id, s.ok])).toEqual([
      ['bottleLure', true],
      ['seenInCorridor', true],
    ])
    expect(report.claims).toEqual([
      { id: 'claim:watchmanLured', ok: true, detail: 'bottleLure passes (4/4)' },
    ])
    // The same report in a second run.
    expect(await playtest(wardScene(), { seeds: 3, policies: ['scripted'] })).toEqual(report)
    const rows = fairness(report, wardScene().def.fairness, wardScene().def)
    expect(rows.find((r) => r.id === 'cautiousWin')?.value).toBe(1)
  })
})

describe('sweep', () => {
  it('rates the scene at each value of a tunable', async () => {
    const result = await sweep(wardScene(), 'watchmanHunt', 1, 3, 3, { seeds: 1, policies: ['scripted'] })
    expect(result.tunable).toBe('watchmanHunt')
    expect(result.rows.map((r) => r.value)).toEqual([1, 2, 3])
    expect(result.rows.every((r) => 'cautiousWin' in r.metrics)).toBe(true)
  })

  it('cannot sweep a scene without retune', async () => {
    const { retune: _retune, ...scene } = wardScene()
    await expect(sweep(scene, 'watchmanHunt', 1, 3, 3)).rejects.toThrow(/cannot be swept/)
  })
})
