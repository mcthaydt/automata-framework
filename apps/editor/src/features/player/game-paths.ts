// Paths inside a game's folder, always with `/` and never leading with one: the form a ProjectStore uses. The app's
// page has no `node:path`, so these are the few calls it needs.

/** `a/b/../c` as `a/c`; `undefined` when it climbs out of the folder. */
export function normalizePath(path: string): string | undefined {
  const parts: string[] = []
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (parts.pop() === undefined) return undefined
    } else parts.push(part)
  }
  return parts.join('/')
}

export const dirOf = (path: string): string => path.slice(0, Math.max(0, path.lastIndexOf('/')))

/** `target` as written from inside `fromDir`: `./x.js`, `../y/z.js`. */
export function relativePath(fromDir: string, target: string): string {
  const from = fromDir === '' ? [] : fromDir.split('/')
  const to = target.split('/')
  let shared = 0
  while (shared < from.length && shared < to.length - 1 && from[shared] === to[shared]) shared++
  const up = from.length - shared
  const rest = to.slice(shared).join('/')
  return up === 0 ? `./${rest}` : `${'../'.repeat(up)}${rest}`
}

/** The package a bare specifier names: `@scope/name` or `name`, without a subpath. */
export function packageName(specifier: string): string {
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? specifier)
}

/** A source file's path as the browser loads it after the compile: TypeScript becomes JavaScript. */
export const outputPath = (path: string): string => path.replace(/\.(?:mts|tsx?)$/, '.js')

export const extensionOf = (path: string): string => {
  const name = path.slice(path.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? '' : name.slice(dot).toLowerCase()
}
