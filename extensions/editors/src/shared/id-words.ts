// An id in words, as the editors show a name a person did not type: `old_sign` and `old-sign` read as "Old sign".
// Writer and Sequence both name things this way, so it lives here rather than in either.

/** `old_sign` and `old-sign` read as "Old sign". */
export function humanize(id: string): string {
  const spaced = id.replace(/[_.-]+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
