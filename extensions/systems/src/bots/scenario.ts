// Scenarios (M6 spec §4.6, SY-b), from the adventure source's `scenario` and `claimsCheck`: a scenario's setup, its
// actions as the bot's plan, and its condition over its declared seeds 1..N. Every measure comes from seeds, so a
// scenario gives the same result in every run.
import type { Scenario } from '../sim/index'
import { createBot, type Policy } from './bot'
import { play } from './play'
import type { Appearance, ScenarioResult } from './results'
import { type SystemsScene, stepsFor } from './scene'

/** The agent a scenario's condition asks as: the first agent it places, else the scene's first agent. */
export const askAs = (scene: SystemsScene, scenario: Scenario): string | undefined =>
  Object.keys(scenario.setup.place ?? {})
    .sort()
    .find((id) => id !== 'player') ?? scene.def.agents[0]?.id

export async function runScenario(
  scene: SystemsScene,
  scenario: Scenario,
  seeds: number = scenario.seeds,
): Promise<ScenarioResult> {
  const plan = stepsFor(scene, scenario.setup.actions ?? [])
  const times: (number | null)[] = []
  const pursuit: { appearances: Appearance[]; ambushCatches: number[]; hides: number[] } = {
    appearances: [],
    ambushCatches: [],
    hides: [],
  }
  let successes = 0
  let deaths = 0
  for (let seed = 1; seed <= seeds; seed++) {
    // Scenarios test the systems, not the player's habits: no light, no reaction delays.
    const { light: _light, ...tactics } = scene.bot ?? {}
    const bot = createBot(scenario.policy as Policy, { ...tactics, player: scene.player, seed, plan })
    const run = await play(scene, {
      bot,
      seed,
      limit: scenario.expect.within,
      setup: scenario.setup,
      until: scenario.expect.condition,
      as: askAs(scene, scenario),
      maxDeaths: 0,
      jitter: 0.25,
    })
    times.push(run.conditionAt)
    deaths += run.deaths.length
    pursuit.appearances.push(...run.appearances)
    pursuit.ambushCatches.push(...run.ambushCatches)
    pursuit.hides.push(...run.hides)
    if (run.outcome === 'condition') successes++
  }
  const probability = successes / seeds
  const measured = pursuit.appearances.length + pursuit.ambushCatches.length + pursuit.hides.length > 0
  return {
    id: scenario.id,
    ...(scenario.claims === undefined ? {} : { claims: scenario.claims }),
    policy: scenario.policy as Policy,
    seeds,
    successes,
    probability,
    expected: scenario.expect.probability,
    within: scenario.expect.within,
    ok: probability >= scenario.expect.probability,
    times,
    deaths,
    ...(measured ? { pursuit } : {}),
  }
}

/** Each puzzle systemic is claimed by a scenario that passes. */
export function claimsCheck(
  scene: SystemsScene,
  results: readonly ScenarioResult[],
): { id: string; ok: boolean; detail: string }[] {
  return scene.puzzle.systemic.map((systemic) => {
    const id = `claim:${systemic.id}`
    const claimed = results.filter((r) => r.claims === systemic.id)
    if (claimed.length === 0) return { id, ok: false, detail: 'no scenario claims it' }
    const passing = claimed.find((r) => r.ok)
    const shown = passing ?? (claimed[0] as ScenarioResult)
    return {
      id,
      ok: passing !== undefined,
      detail: `${shown.id} ${passing ? 'passes' : 'fails'} (${shown.successes}/${shown.seeds})`,
    }
  })
}
