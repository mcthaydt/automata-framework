// Fair play in words: the scenarios as sentences, and what the game's check found, said so a person can act on it. The
// check is the game's own code (it plays a careful player and a scripted one through the scene); this only says what it
// printed.
import type { CheckResult } from '@automata/editor/kit/ports'
import type { SystemsDef } from '@automata/systems/sim'
import { conditionWords } from './pieces/conditions.ts'
import { modeWords, type Names, num } from './pieces/piece.ts'

type Scenario = SystemsDef['scenarios'][number]

/** The check the Fair play page runs: its `[[check]]` row in the editor list has this id, and no file row names it. */
export const FAIR_CHECK = 'fair-play'

const percent = (fraction: number): string => `${num(Math.round(fraction * 1000) / 10)} %`

/** "A careful player who hides gets past the porter: a careful player is at lobby within 90 s, in at least 80 % of 20 tries." */
export function scenarioWords(scenario: Scenario, names: Names): string {
  const what = scenario.expect.condition.map((probe) => conditionWords(probe, names)).join(' and ')
  const claim = scenario.claims ?? modeWords(scenario.id)
  return `${claim}: a ${scenario.policy} player ${what === '' ? 'plays' : what} within ${num(scenario.expect.within)} s, in at least ${percent(scenario.expect.probability)} of ${num(scenario.seeds)} tries.`
}

const lower = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1)
const firstLine = (text: string): string => text.split('\n').find((line) => line.trim() !== '') ?? ''

/** What the check found, in a sentence. */
export function fairVerdict(result: CheckResult): string {
  if (result.status === 'error') return `The check could not run: ${firstLine(result.output)}`.trimEnd()
  const measures = result.measure ?? []
  if (measures.length === 0)
    return result.status === 'fail'
      ? `Not fair yet: ${result.findings.find((f) => f.severity === 'error')?.message ?? 'the check failed'}`
      : 'Fair: the check passes.'
  const passing = measures.filter((m) => m.ok).length
  const first = measures.find((m) => !m.ok)
  if (first === undefined) return `Fair: ${passing} of ${measures.length} checks pass.`
  const target = first.threshold === undefined ? '' : `, the target is ${num(first.threshold)}`
  return `Not fair yet: ${lower(first.label)} is ${num(first.value)}${target}. ${passing} of ${measures.length} checks pass.`
}
