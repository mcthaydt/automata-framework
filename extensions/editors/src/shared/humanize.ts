// How an id reads to a person. Writer and Sequence both show ids this way, so it lives in shared/.

/** `old_sign` and `old-sign` read as "Old sign". */
export function humanize(id: string): string {
  const spaced = id.replace(/[_.-]+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
