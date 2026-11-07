// `hintProbes`: for each lethal rule and route that exposes its risk, each `hintedBy` action played in
// the sim at the first point the route can take it, and the lines it showed.
import { describe, expect, it } from 'vitest'
import { hintCheck } from '#src/features/tools/coverage.ts'
import { hintProbes } from '#src/features/tools/hint-probes.ts'
import { solverRoutes } from '#src/features/tools/traces.ts'
import { toyTraceGame, toyTraceScene } from '#src/testing/toy-trace.ts'

const withLethal = () => {
  const base = toyTraceScene()
  return {
    ...base,
    def: {
      ...base.def,
      systemic: [
        {
          id: 'leak',
          note: 'the door floods the floor',
          enables: [{ fact: 'wet', is: true }],
          via: ['door.unlock'],
          risk: 'lethal' as const,
        },
      ],
      lethal: [{ id: 'liveWater', rule: 'A wet floor kills.', hintedBy: ['drawer.open'] }],
    },
  }
}

describe('hintProbes', () => {
  it('plays the hint action before the exposing step and records the lines it shows', async () => {
    const puzzle = withLethal()
    const game = toyTraceGame({ puzzle })
    const { probes, exposes } = await hintProbes(game, solverRoutes(puzzle))
    expect(exposes).toEqual([{ lethal: 'liveWater', route: 'shortest', step: 2 }])
    expect(probes).toHaveLength(1)
    expect(probes[0]).toMatchObject({ lethal: 'liveWater', route: 'shortest', action: 'drawer.open' })
    expect(probes[0]?.lines).toContain('toy.drawer')
  })
  it('feeds hintCheck: a tagged line shown before the risk passes, an untagged one fails', async () => {
    const puzzle = withLethal()
    const game = toyTraceGame({ puzzle })
    const { probes, exposes } = await hintProbes(game, solverRoutes(puzzle))
    const input = { lethal: puzzle.def.lethal, probes, exposes, scene: 'toy', barksRequired: true }
    const tagged = game.records.map((r) => (r.id === 'toy.drawer' ? { ...r, hints: ['liveWater'] } : r))
    expect(hintCheck({ ...input, records: tagged }).findings).toEqual([])
    expect(hintCheck({ ...input, records: game.records }).findings.map((f) => f.rule)).toEqual([
      'untagged',
      'hint-line',
    ])
  })
  it('records nothing for a route that never exposes a risk', async () => {
    const game = toyTraceGame()
    expect(await hintProbes(game, solverRoutes(game.puzzle))).toEqual({ probes: [], exposes: [] })
  })
})
