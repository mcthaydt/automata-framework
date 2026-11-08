// Keeps the shell's regions (panel, inspector, dock) from covering each other: on a compact screen only one sheet is
// open at a time.
import type { ShellMode, ShellRegion } from './shell-mode'

export interface OpenState {
  readonly panel: boolean
  readonly inspector: boolean
  readonly dock: boolean
}

/** The order that settles ties. */
const REGIONS: readonly ShellRegion[] = ['panel', 'inspector', 'dock']

/**
 * In `compact` one sheet is open at a time: the region that just opened wins and the others close. Of two
 * that opened together the later one in panel, inspector, dock order wins; when several are open and none
 * just opened (an initial state), the first does. `wide` and `medium` return `next` unchanged.
 */
export function reconcileOpen(mode: ShellMode, previous: OpenState, next: OpenState): OpenState {
  if (mode !== 'compact') return next
  const open = REGIONS.filter((region) => next[region])
  if (open.length <= 1) return next
  const justOpened = open.filter((region) => !previous[region])
  const keep = justOpened.length > 0 ? justOpened[justOpened.length - 1] : open[0]
  return { panel: keep === 'panel', inspector: keep === 'inspector', dock: keep === 'dock' }
}
