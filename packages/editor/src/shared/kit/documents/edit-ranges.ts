// Which parts of a text an edit changed, as [start, end) ranges. An edit is reported in the new text, so the ranges of
// earlier edits move when a later one rewrites something before them, and ranges that touch merge into one.
// Pure arithmetic on numbers and strings.

/** Where two texts differ: the common prefix's length, and how long the differing middle is in each. */
export function difference(before: string, after: string): { at: number; removed: number; added: number } {
  let at = 0
  while (at < before.length && before[at] === after[at]) at++
  let suffix = 0
  while (
    suffix < before.length - at &&
    suffix < after.length - at &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  )
    suffix++
  return { at, removed: before.length - at - suffix, added: after.length - at - suffix }
}

export type Range = readonly [number, number]

/** Moves earlier ranges through a later rewrite of `[at, at + removed)` into `added` characters. */
export function carry(
  ranges: readonly Range[],
  change: { at: number; removed: number; added: number },
): Range[] {
  const { at, removed, added } = change
  const shift = added - removed
  return ranges.map(([start, end]): Range => {
    if (end <= at) return [start, end]
    if (start >= at + removed) return [start + shift, end + shift]
    return [Math.min(start, at), Math.max(end + shift, at + added)]
  })
}

/** Sorted, with touching or overlapping ranges merged. */
export function merged(ranges: readonly Range[]): Range[] {
  const out: [number, number][] = []
  for (const [start, end] of [...ranges].sort((a, b) => a[0] - b[0])) {
    const last = out[out.length - 1]
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else out.push([start, end])
  }
  return out
}
