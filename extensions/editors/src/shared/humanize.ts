// `old_sign` and `old-sign` read as "Old sign": an id, said the way a person would say it. Shared because Writer and
// Sequence both show ids to people.
export function humanize(id: string): string {
  const spaced = id.replace(/[_.-]+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
