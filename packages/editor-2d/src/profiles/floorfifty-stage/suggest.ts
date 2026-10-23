// Suggesting the name someone meant (EDFF.1b): the alias of a layer or asset, the name of a tunable. Names come from short,
// regular vocabularies (`world.cityNear`, `COURSE_FLOOR_COUNT`), so edit distance finds the one that was meant.

/** The number of single-character edits between two strings; swapping two neighbours counts as one (`Naer` for `Near`). */
function editDistance(a: string, b: string): number {
  let beforePrevious: number[] = []
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      const same = a[i - 1] === b[j - 1] ? 0 : 1
      let best = Math.min((previous[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + same)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        best = Math.min(best, (beforePrevious[j - 2] ?? 0) + 1)
      row.push(best)
    }
    beforePrevious = previous
    previous = row
  }
  return previous[b.length] ?? 0
}

/**
 * The known names nearest to `alias` by edit distance, ignoring case, nearest first and alphabetical among equals. Only
 * names within a sixth of the alias's length (and at least one edit) are offered, so a wild guess gets no suggestion.
 */
export function suggestNames(alias: string, known: Iterable<string>, limit = 3): readonly string[] {
  const reach = Math.max(1, Math.floor(alias.length / 6))
  const lowered = alias.toLowerCase()
  return [...known]
    .filter((name) => name !== alias)
    .map((name) => ({ name, distance: editDistance(lowered, name.toLowerCase()) }))
    .filter(({ distance }) => distance <= reach)
    .sort((a, b) => a.distance - b.distance || (a.name < b.name ? -1 : 1))
    .slice(0, limit)
    .map(({ name }) => name)
}

/** `"a"`, `"a" or "b"`, `"a", "b" or "c"`. */
export function either(names: readonly string[]): string {
  const quoted = names.map((name) => `"${name}"`)
  const last = quoted.at(-1)
  return quoted.length < 2 ? quoted.join('') : `${quoted.slice(0, -1).join(', ')} or ${last}`
}
