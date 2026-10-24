// The path rules every ProjectStore shares (kit spec §4.7): relative, '/'-separated, and nothing that could
// climb out of the store. A bad path is a bug in the caller, so it throws instead of returning a result.

function refuse(path: string, why: string): never {
  throw new RangeError(`Not a store path (${why}): ${JSON.stringify(path)}`)
}

function checkSegments(path: string, segments: readonly string[]): void {
  for (const segment of segments) {
    if (segment === '') refuse(path, 'empty segment')
    if (segment === '.' || segment === '..') refuse(path, `"${segment}" segment`)
  }
}

function checkCharacters(path: string): void {
  if (path.includes('\\')) refuse(path, 'backslash')
  if (path.includes('\0')) refuse(path, 'NUL')
}

/** Throws a `RangeError` unless `path` names a file: `a`, `stages/a.toml`. */
export function assertStorePath(path: string): void {
  if (path === '') refuse(path, 'empty')
  checkCharacters(path)
  checkSegments(path, path.split('/'))
}

/** Like `assertStorePath`, but the empty string and a trailing slash are fine: a prefix is not a file. */
export function assertStorePrefix(prefix: string): void {
  checkCharacters(prefix)
  if (prefix === '') return
  const segments = prefix.split('/')
  if (segments[segments.length - 1] === '') segments.pop()
  checkSegments(prefix, segments)
}

/** Code-unit order, so every adapter lists in the same order whatever the locale. */
export function comparePaths(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
