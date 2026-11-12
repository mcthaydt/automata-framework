// Which of the rail's tabs a phone's bar shows at their full size, and which go under its last tab, More. Targets never
// shrink to fit (the framework's responsive rule), so what does not fit is folded away, not squeezed.

export interface RailFit {
  /** Indexes of the tabs drawn in the bar, in order. */
  readonly shown: readonly number[]
  /** Indexes of the tabs under More, in order; empty when everything fits. */
  readonly more: readonly number[]
}

/**
 * `widths` are the tabs' natural widths, `room` the bar's width and `moreWidth` the width of the More tab, reserved
 * once anything is folded. The open editor (`open`) is always one of the shown tabs, so the person sees where they are;
 * the others are taken left to right while they fit. At least one tab is shown. With no layout to measure (`room` of 0)
 * everything is shown.
 */
export function railFit(
  widths: readonly number[],
  room: number,
  open: number | undefined,
  moreWidth: number,
): RailFit {
  const all = widths.map((_, index) => index)
  const total = widths.reduce((sum, width) => sum + width, 0)
  if (room <= 0 || total <= room) return { shown: all, more: [] }

  const available = room - moreWidth
  const kept = new Set<number>()
  let used = 0
  if (open !== undefined && open >= 0 && open < widths.length) {
    kept.add(open)
    used = widths[open] ?? 0
  }
  for (const index of all) {
    if (kept.has(index)) continue
    const width = widths[index] ?? 0
    if (used + width > available && kept.size > 0) break
    kept.add(index)
    used += width
  }
  const shown = all.filter((index) => kept.has(index))
  return { shown, more: all.filter((index) => !kept.has(index)) }
}
