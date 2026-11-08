// Which editors the compact tab bar shows. A phone has room for four tabs and a More: the first four in the suite's
// order, except that the open editor always has a tab, so when it would be under More it takes the fourth slot (and the
// editor that was there moves to More). With five editors or fewer there is no More and every editor shows.
import type { Keyed } from './rail-keys.ts'

export interface TabSlots<T extends Keyed> {
  readonly shown: readonly T[]
  readonly more: readonly T[]
}

export function tabSlots<T extends Keyed>(entries: readonly T[], current: string | undefined, slots = 4): TabSlots<T> {
  if (entries.length <= slots + 1) return { shown: entries, more: [] }
  const first = entries.slice(0, slots)
  const open = entries.find((entry) => entry.id === current)
  const shown = open === undefined || first.includes(open) ? first : [...first.slice(0, slots - 1), open]
  return { shown, more: entries.filter((entry) => !shown.includes(entry)) }
}
