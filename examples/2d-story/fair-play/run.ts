import { runScenario } from '@automata/systems/bots'
import { scene } from './scene.ts'

// The story's fair-play check, as the editor's Check now reads it: one measure for each scenario in the guard's file,
// its share of tries that held against the share the file asks for. Each try is a real run of the story's sim, so the
// number moves when the guard's file does.

interface Measure {
  readonly id: string
  readonly label: string
  readonly value: number
  readonly threshold: number
  readonly ok: boolean
}

const percent = (fraction: number): number => Math.round(fraction * 1000) / 10

export async function check(): Promise<{ readonly measure: Measure[] }> {
  const measure: Measure[] = []
  for (const scenario of scene.def.scenarios) {
    const result = await runScenario(scene, scenario)
    measure.push({
      id: scenario.id,
      label: `${scenario.claims ?? scenario.id} (% of ${result.seeds} tries)`,
      value: percent(result.probability),
      threshold: percent(result.expected),
      ok: result.ok,
    })
  }
  return { measure }
}
