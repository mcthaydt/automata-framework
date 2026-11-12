// The creature's rules, with every call the old game made given a fate (the plan's audit 7):
//   chase     → `goTo = "player"`                       fleeGoal → `flee = "light"`
//   replan    → stays a call: the game answers it with the systems' re-route on a clock
//   stop, leave, wake, vigil → stay calls: the night feature answers them
//   R15 (`burnLight`) and the `footsteps` rule → dropped: the lamp burns its own fuel, and the steps system calls `hear`
//   the old fact `light` → `lit`; a matrix cell that cited R15 → a cut that says the lamp feature burns the paraffin
import { parse, stringify } from 'smol-toml'
import type { Converted, Unexpressed } from './report.ts'

const SYSTEMS_PATH = 'content/systems/prologue.toml'

const HEADER =
  "# The prologue's creature: its rules, modes and tuned numbers. They were converted once from the game's prologue at\n# 92e6704 (through October's fixture), and this file is now the source: edit it by hand and in Schematic and the Tuner.\n"

const DROPPED_RULES: ReadonlySet<string> = new Set(['R15', 'footsteps'])
const DROPPED_HOOKS: ReadonlySet<string> = new Set(['chase', 'fleeGoal'])

type Json = Record<string, unknown>

/** Every object and array in `value`, depth first, handed to `visit` (which may change it in place). */
function walk(value: unknown, visit: (node: Json) => void): void {
  if (Array.isArray(value)) for (const item of value) walk(item, visit)
  else if (typeof value === 'object' && value !== null) {
    visit(value as Json)
    for (const child of Object.values(value)) walk(child, visit)
  }
}

/** The systems file with each call rewritten as above. */
export function rewriteCalls(systems: string): Converted {
  const file = parse(systems) as Json
  const report: Unexpressed[] = []
  const rules = file.rules as Json[] | undefined
  if (rules !== undefined)
    file.rules = rules.filter((rule) => {
      const drop = DROPPED_RULES.has(String(rule.id))
      if (drop)
        report.push({
          kind: 'systems',
          where: `rule ${String(rule.id)}`,
          what: String(rule.text),
          did: 'dropped',
        })
      return !drop
    })
  const matrix = file.matrix as Json[] | undefined
  for (const cell of matrix ?? [])
    if (typeof cell.rule === 'string' && DROPPED_RULES.has(cell.rule)) {
      report.push({
        kind: 'systems',
        where: `matrix ${String(cell.row)} × ${String(cell.col)}`,
        what: `cited the dropped rule ${cell.rule}`,
        did: 'approximated',
      })
      delete cell.rule
      cell.cut = 'the hand lamp burns its own paraffin (the lamp feature), not a rule of the creature'
    }
  const counts = { chase: 0, fleeGoal: 0, light: 0 }
  walk(file, (node) => {
    if (node.call === 'chase') {
      delete node.call
      node.goTo = 'player'
      counts.chase += 1
    } else if (node.call === 'fleeGoal') {
      delete node.call
      node.flee = 'light'
      counts.fleeGoal += 1
    }
    if (node.fact === 'light') {
      node.fact = 'lit'
      node.is = node.is === 'off' ? false : true
      counts.light += 1
    }
    if (Array.isArray(node.hooks))
      node.hooks = (node.hooks as string[]).filter((hook) => !DROPPED_HOOKS.has(hook))
  })
  if (counts.chase > 0)
    report.push({
      kind: 'systems',
      where: 'chase',
      what: `${counts.chase} call(s) written as goTo = "player"`,
      did: 'approximated',
    })
  if (counts.fleeGoal > 0)
    report.push({
      kind: 'systems',
      where: 'fleeGoal',
      what: `${counts.fleeGoal} call(s) written as flee = "light"`,
      did: 'approximated',
    })
  if (counts.light > 0)
    report.push({
      kind: 'systems',
      where: 'fact light',
      what: `${counts.light} condition(s) now read the fact lit`,
      did: 'approximated',
    })
  return { files: { [SYSTEMS_PATH]: `${HEADER}${stringify(file)}\n` }, report }
}
