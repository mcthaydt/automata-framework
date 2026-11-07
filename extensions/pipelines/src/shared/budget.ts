import type { BudgetKey } from './pipeline.ts'
import type { Budget } from './pipeline-toml.schema.ts'

/** Units per budget key. */
export type Units = Readonly<Record<BudgetKey, number>>

/**
 * Why a run that needs `need` must not start, or `undefined` when it may. A key is refused when `pipeline.toml` has
 * no budget for it (fail closed: an unbudgeted paid call never runs), when the need passes the run budget (lowered,
 * never raised, by `--budget`), or when it passes what is left of the project budget after `spent` (the ledger).
 * Keys are checked in sorted order, so the message is the same on every machine.
 */
export function budgetRefusal(
  need: Units,
  toml: { readonly budget: Readonly<Record<string, Budget>> },
  spent: Units,
  option: Units = {},
): string | undefined {
  for (const key of Object.keys(need).sort()) {
    const units = need[key] ?? 0
    if (units <= 0) continue
    const budget = toml.budget[key]
    if (budget === undefined) return `no budget for ${key}: set [budget.${key}] in pipeline.toml`
    const run = Math.min(budget.run, option[key] ?? budget.run)
    if (units > run) return `over budget: this run needs ${units} ${key}, the run budget is ${run}`
    const left = budget.project - (spent[key] ?? 0)
    if (units > left)
      return `over budget: this run needs ${units} ${key}, the project has ${Math.max(left, 0)} of ${budget.project} left`
  }
  return undefined
}

const PAIR = /^([a-z][A-Za-z0-9]*)=(\d+)$/

/** `--budget images=2,meshyCredits=40`: per-run caps for this run. Throws on a part that is not `key=N`. */
export function parseBudgetOption(text: string): Units {
  const caps: Record<string, number> = {}
  for (const part of text.split(',').map((piece) => piece.trim())) {
    const match = PAIR.exec(part)
    if (match === null) throw new Error(`--budget: '${part}' is not key=N (N a whole number)`)
    caps[match[1] as string] = Number(match[2])
  }
  return caps
}
