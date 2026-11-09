// Fairness maths, the original game's synthetic cases: the rows a playtest and its scenarios are
// rated on, each with its measured value and whether it meets the scene's threshold.
import { describe, expect, it } from 'vitest'
import { fairness, type PlaytestRun, type ScenarioResult } from '#src/entries/bots.ts'

const run = (over: Partial<PlaytestRun>): PlaytestRun => ({
  route: 'r',
  entry: 'start',
  policy: 'cautious',
  seed: 1,
  outcome: 'win',
  time: 60,
  deaths: [],
  firstThreat: 30,
  telegraphs: [],
  modes: {},
  safeWindows: [],
  skeleton: [],
  conditionAt: null,
  appearances: [],
  ambushCatches: [],
  hides: [],
  ...over,
})
const thresholds = {
  cautiousWin: 0.9,
  firstThreatAfter: 20,
  telegraph: 1.5,
  maxDeathsPerRun: 1,
  safeWindowMargin: 1.3,
}

describe('fairness maths, on a synthetic playtest', () => {
  it('rates ambush grace, door-follow clearance and hide release, over runs and scenarios, where the scene sets them', () => {
    const f = { ...thresholds, ambushGrace: 2, followClear: 1.5, hideRelease: 12 }
    const fair = fairness(
      {
        runs: [
          run({
            appearances: [{ t: 9, agent: 'nurse', mode: 'follow', gap: 2.4 }],
            ambushCatches: [3.1],
            hides: [4],
          }),
        ],
      },
      f,
    )
    const pursuit = (rows: ReturnType<typeof fairness>) =>
      Object.fromEntries(
        rows
          .filter((r) => ['ambushGrace', 'followClear', 'hideRelease'].includes(r.id))
          .map((r) => [r.id, [r.value, r.ok]]),
      )
    expect(pursuit(fair)).toEqual({
      ambushGrace: [3.1, true],
      followClear: [2.4, true],
      hideRelease: [4, true],
    })
    const scenarios: ScenarioResult[] = [
      {
        id: 's',
        policy: 'scripted',
        seeds: 1,
        successes: 1,
        probability: 1,
        expected: 1,
        within: 5,
        ok: true,
        times: [1],
        deaths: 1,
        pursuit: {
          appearances: [{ t: 1, agent: 'nurse', mode: 'follow', gap: 1.2 }],
          ambushCatches: [1.5],
          hides: [13],
        },
      },
    ]
    const unfair = Object.fromEntries(fairness({ runs: [run({})], scenarios }, f).map((r) => [r.id, r.ok]))
    expect(unfair).toMatchObject({ ambushGrace: false, followClear: false, hideRelease: false })
    // Without the thresholds the rows are not reported.
    expect(fairness({ runs: [run({})], scenarios }, thresholds).map((r) => r.id)).toEqual([
      'cautiousWin',
      'firstThreatAfter',
      'telegraph',
      'maxDeathsPerRun',
      'safeWindowMargin',
    ])
  })

  it('passes a fair report', () => {
    const rows = fairness(
      { runs: Array.from({ length: 10 }, (_, i) => run({ seed: i, telegraphs: [2] })) },
      thresholds,
    )
    expect(rows.every((r) => r.ok)).toBe(true)
    expect(rows.find((r) => r.id === 'cautiousWin')?.value).toBe(1)
  })

  it('reports each miss with its number', () => {
    const runs = [
      ...Array.from({ length: 8 }, (_, i) => run({ seed: i })),
      run({
        outcome: 'lose',
        deaths: [
          { cause: 'nurse', t: 9, telegraph: 0.8 },
          { cause: 'nurse', t: 12, telegraph: 1.1 },
        ],
        telegraphs: [0.8, 1.1],
        firstThreat: 8.8,
      }),
      run({ outcome: 'timeout' }),
      run({ policy: 'scripted', outcome: 'lose', firstThreat: 5 }),
    ]
    const rows = Object.fromEntries(fairness({ runs }, thresholds).map((r) => [r.id, r]))
    expect([rows.cautiousWin?.value, rows.cautiousWin?.ok]).toEqual([0.8, false])
    expect([rows.firstThreatAfter?.value, rows.firstThreatAfter?.ok]).toEqual([5, false])
    expect([rows.telegraph?.value, rows.telegraph?.ok]).toEqual([0.8, false])
    expect([rows.maxDeathsPerRun?.value, rows.maxDeathsPerRun?.ok]).toEqual([2, false])
  })

  it('no threats and no catches are not misses', () => {
    expect(fairness({ runs: [run({ firstThreat: null })] }, thresholds).filter((r) => !r.ok)).toEqual([])
  })
})
