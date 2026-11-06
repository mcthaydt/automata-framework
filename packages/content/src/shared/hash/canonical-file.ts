// The committed form of a generated JSON file. (`canonicalizeValue`): the files are committed, so "the same content" has to mean "the same
// bytes". Keys are sorted at every depth, arrays keep the order they were built in (order there is meaning),
// and the text is indented two spaces with one trailing newline so it reads and diffs like hand-written JSON.
//
// Keys are sorted by UTF-16 code unit (`Array.prototype.sort`'s default), never by
// `localeCompare`, whose order depends on the machine's locale and ICU version.

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (typeof value !== 'object' || value === null) return value
  const record = value as Record<string, unknown>
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(record).sort()) sorted[key] = sortKeys(record[key])
  return sorted
}

export function canonicalFile(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`
}
