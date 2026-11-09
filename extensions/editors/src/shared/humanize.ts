// A key read as words: Writer's lines and Sequence's names both show one, so it lives here and not in either feature.

/** `old_sign` and `old-sign` read as "Old sign". */
export function humanize(id: string): string {
  const spaced = id.replace(/[_.-]+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
