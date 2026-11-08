// Picking a file name the workspace does not have yet: `name.ext`, then `name 2.ext`, `name 3.ext`, and for a copy
// `name copy.ext`, `name copy 2.ext`. Pure string work, so the app only asks the store which names are taken.

/** The stem and the extension of `path`; the extension starts at the first dot of the file name, so `a.af2d.json` keeps both parts, and a name that starts with a dot has none. */
export function splitName(path: string): { stem: string; extension: string } {
  const name = path.lastIndexOf('/') + 1
  const dot = path.indexOf('.', name + 1)
  return dot === -1 ? { stem: path, extension: '' } : { stem: path.slice(0, dot), extension: path.slice(dot) }
}

/** `path` itself (or `stem` + `label`, for a copy) when `taken` lacks it; otherwise the first free `… 2`, `… 3`. */
export function uniqueName(path: string, taken: ReadonlySet<string>, label = ''): string {
  const { stem, extension } = splitName(path)
  const base = `${stem}${label}`
  let free = `${base}${extension}`
  for (let n = 2; taken.has(free); n += 1) free = `${base} ${n}${extension}`
  return free
}
