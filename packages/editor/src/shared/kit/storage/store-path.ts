// The path rules every ProjectStore shares: relative, '/'-separated, and nothing that could
// climb out of the store. A bad path is a bug in the caller, so the stores throw instead of returning a result;
// `storePathProblem` asks the same question without throwing, for paths that come from outside (an import).

function charactersProblem(path: string): string | undefined {
  if (path.includes('\\')) return 'backslash'
  if (path.includes('\0')) return 'NUL'
  return undefined
}

function segmentsProblem(segments: readonly string[]): string | undefined {
  for (const segment of segments) {
    if (segment === '') return 'empty segment'
    if (segment === '.' || segment === '..') return `"${segment}" segment`
  }
  return undefined
}

/** Why `path` names no file in a store (`empty`, `backslash`, `".." segment`), or `undefined` when it does. */
export function storePathProblem(path: string): string | undefined {
  if (path === '') return 'empty'
  return charactersProblem(path) ?? segmentsProblem(path.split('/'))
}

function refuse(path: string, why: string | undefined): void {
  if (why !== undefined) throw new RangeError(`Not a store path (${why}): ${JSON.stringify(path)}`)
}

/** Throws a `RangeError` unless `path` names a file: `a`, `stages/a.toml`. */
export function assertStorePath(path: string): void {
  refuse(path, storePathProblem(path))
}

/** Like `assertStorePath`, but the empty string and a trailing slash are fine: a prefix is not a file. */
export function assertStorePrefix(prefix: string): void {
  refuse(prefix, charactersProblem(prefix))
  if (prefix === '') return
  const segments = prefix.split('/')
  if (segments[segments.length - 1] === '') segments.pop()
  refuse(prefix, segmentsProblem(segments))
}

/** Code-unit order, so every adapter lists in the same order whatever the locale. */
export function comparePaths(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** The file name of a store path: `stages/a.toml` is `a.toml`. */
export const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)
