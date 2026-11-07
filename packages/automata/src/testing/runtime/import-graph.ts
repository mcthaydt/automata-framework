import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

/*
 * Internal test helper (not exported from any entry): which packages does a file import at run time?
 * Used to prove an entry point stays loadable in Node (`./extension`) and that the per-frame path
 * never touches `effect` (`frame-loop-purity.test.ts`).
 *
 * It reads source text with regular expressions instead of parsing it. That is enough for this repo's
 * import style and keeps the helper small. It does not see dynamic `import('x')` calls.
 */

// `import a from 'x'`, `import { a } from 'x'`, `import * as a from 'x'`. The clause may only contain
// names, braces, commas and `*`, so one match can never run on into the next statement.
const IMPORT_FROM = /^[ \t]*import\s+(type\s+)?[\w$\s,{}*]+?\s+from\s*['"]([^'"]+)['"]/gm
// `export { a } from 'x'`, `export * from 'x'`, `export * as a from 'x'`.
const EXPORT_FROM =
  /^[ \t]*export\s+(type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/gm
// `import 'x'` (runs the module for its side effects).
const BARE_IMPORT = /^[ \t]*import\s*['"]([^'"]+)['"]/gm

/**
 * Every non-relative module specifier reachable from `entry` through value imports.
 * `import type` and `export type` statements are skipped. An inline `import { type A, B }` counts as a
 * value import on purpose: the check stays conservative and never reports "clean" for a file that may
 * load a package.
 */
export function valueImportsOf(entry: string): Set<string> {
  const packages = new Set<string>()
  const visited = new Set<string>()
  const pending = [resolve(entry)]

  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    if (visited.has(file)) continue
    visited.add(file)

    for (const specifier of valueSpecifiersIn(readFileSync(file, 'utf8'))) {
      if (specifier.startsWith('.')) {
        pending.push(resolveRelative(file, specifier))
      } else {
        packages.add(specifier)
      }
    }
  }
  return packages
}

function valueSpecifiersIn(source: string): string[] {
  const specifiers: string[] = []
  for (const match of source.matchAll(IMPORT_FROM)) {
    if (match[1] === undefined) specifiers.push(match[2] as string)
  }
  for (const match of source.matchAll(EXPORT_FROM)) {
    if (match[1] === undefined) specifiers.push(match[2] as string)
  }
  for (const match of source.matchAll(BARE_IMPORT)) {
    specifiers.push(match[1] as string)
  }
  return specifiers
}

/** Finds the file a relative import means: the path itself, then `.ts`, `.svelte.ts`, then `/index.ts`. */
function resolveRelative(fromFile: string, specifier: string): string {
  const base = resolve(dirname(fromFile), specifier)
  const stripped = specifier.endsWith('.js') ? resolve(dirname(fromFile), specifier.slice(0, -3)) : undefined
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.svelte.ts`,
    `${base}/index.ts`,
    ...(stripped ? [stripped, `${stripped}.ts`, `${stripped}.svelte.ts`, `${stripped}/index.ts`] : []),
  ]
  const found = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile())
  if (found === undefined) {
    throw new Error(`import-graph: cannot resolve '${specifier}' imported from ${fromFile}`)
  }
  return found
}
