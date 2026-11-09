// Playtests and sweeps: every route the scene
// gives, for each policy and seed, with the scene's scenarios and their claims; a sweep rates the scene at each value
// of a tunable through the scene's `retune`.
import { createBot, type Policy } from './bot'
import { fairness } from './fairness'
import { play } from './play'
import type { PlaytestRun, ScenarioResult } from './results'
import { claimsCheck, runScenario } from './scenario'
import type { SystemsScene } from './scene'

export interface PlaytestOptions {
  /** Seeds per route and policy (1..N). Default 2. */
  readonly seeds?: number
  /** Default scripted and cautious. */
  readonly policies?: readonly Policy[]
  /** Seconds a route's run may take. Default 120. */
  readonly limit?: number
  /** Run the scene's scenarios too. Default true. */
  readonly scenarios?: boolean
}
export interface Playtest {
  readonly runs: readonly PlaytestRun[]
  readonly scenarios: readonly ScenarioResult[]
  readonly claims: readonly { readonly id: string; readonly ok: boolean; readonly detail: string }[]
}

async function routeRuns(scene: SystemsScene, o: PlaytestOptions): Promise<PlaytestRun[]> {
  const runs: PlaytestRun[] = []
  for (const route of scene.routes)
    for (const policy of o.policies ?? ['scripted', 'cautious'])
      for (let seed = 1; seed <= (o.seeds ?? 2); seed++) {
        const bot = createBot(policy, { ...scene.bot, player: scene.player, seed, plan: route.plan })
        const run = await play(scene, { bot, seed, limit: o.limit ?? 120 })
        runs.push({ route: route.name, entry: 'start', policy, seed, ...run })
      }
  return runs
}

export async function playtest(scene: SystemsScene, o: PlaytestOptions = {}): Promise<Playtest> {
  const runs = await routeRuns(scene, o)
  const scenarios: ScenarioResult[] = []
  if (o.scenarios ?? true) for (const s of scene.def.scenarios) scenarios.push(await runScenario(scene, s))
  return { runs, scenarios, claims: o.scenarios === false ? [] : claimsCheck(scene, scenarios) }
}

export interface SweepRow {
  readonly value: number
  readonly metrics: Readonly<Record<string, number | null>>
  readonly ok: boolean
}
export interface Sweep {
  readonly tunable: string
  readonly rows: readonly SweepRow[]
}

export async function sweep(
  scene: SystemsScene,
  tunable: string,
  from: number,
  to: number,
  steps: number,
  o: PlaytestOptions = {},
): Promise<Sweep> {
  const { retune } = scene
  if (retune === undefined)
    throw new Error(`${scene.id}: the scene has no retune(name, value), so it cannot be swept`)
  const rows: SweepRow[] = []
  for (let i = 0; i < steps; i++) {
    const value = Number((steps === 1 ? from : from + ((to - from) * i) / (steps - 1)).toFixed(6))
    const tuned = retune(tunable, value)
    const runs = await routeRuns(tuned, { policies: ['cautious'], ...o })
    const rated = fairness({ runs }, tuned.def.fairness, tuned.def)
    rows.push({
      value,
      metrics: Object.fromEntries(rated.map((r) => [r.id, r.value])),
      ok: rated.every((r) => r.ok),
    })
  }
  return { tunable, rows }
}
