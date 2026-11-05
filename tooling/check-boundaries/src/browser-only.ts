import { existsSync, readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { join } from 'node:path'
import type { Finding } from './check.ts'
import { collectSources } from './files.ts'
import { readImports, resolveRelative } from './imports.ts'

// The `--browser` check (Effect stays in Node tooling, ADR 0003): no file a
// browser entry reaches imports Effect, a Node built-in or a Node-only library. Reachability follows relative value
// imports from the entry files in `src/entries/`. `import type` brings no code, so it neither counts nor leads
// anywhere.

const NODE_BUILTINS: ReadonlySet<string> = new Set(builtinModules)
const NODE_ONLY_LIBRARIES: ReadonlySet<string> = new Set(['fontkit', 'pngjs', 'subset-font'])

/** The package name part of a specifier: `effect/Effect` → `effect`, `@scope/pkg/sub` → `@scope/pkg`. */
function packageName(specifier: string): string {
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] as string)
}

/** Why a bare specifier cannot run in a browser, or undefined when it can. */
function whyNotInBrowser(specifier: string): string | undefined {
  const name = packageName(specifier)
  if (name === 'effect') return 'Effect is for Node tooling only (ADR 0003).'
  if (specifier.startsWith('node:') || NODE_BUILTINS.has(name))
    return 'Node built-ins do not exist in a browser; keep this in the Node tooling package.'
  if (NODE_ONLY_LIBRARIES.has(name))
    return `"${name}" is a Node-only library; keep it in the Node compiler files.`
  return undefined
}

/**
 * The files reachable from a package's browser entries and the findings among them. `entryNames` limits the
 * entries read (`['locale']` is `src/entries/locale.ts`) for a package that has Node entries too; left out, every
 * file in `src/entries/` is a browser entry.
 */
export function browserOnlyFindings(
  packageRoot: string,
  entryNames?: readonly string[],
): { files: string[]; findings: Finding[] } {
  const entriesDir = join(packageRoot, 'src', 'entries')
  const entries =
    entryNames === undefined
      ? collectSources(entriesDir)
      : entryNames.map((name) => {
          const file = join(entriesDir, `${name}.ts`)
          if (!existsSync(file))
            throw new Error(`check-boundaries: no browser entry ${file} (entries/${name}.ts)`)
          return file
        })

  const reached = new Map<string, string>()
  const queue: string[] = []
  for (const entry of entries) {
    reached.set(entry, entry)
    queue.push(entry)
  }
  const findings: Finding[] = []
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    const { imports, errors } = readImports(next, readFileSync(next, 'utf8'))
    findings.push(...errors)
    for (const { specifier, line, col, typeOnly } of imports) {
      if (typeOnly) continue
      if (specifier.startsWith('.')) {
        const target = resolveRelative(next, specifier)
        // A stylesheet has no imports to follow and no code that could need Node.
        if (target === undefined || reached.has(target) || target.endsWith('.css')) continue
        reached.set(target, reached.get(next) as string)
        queue.push(target)
        continue
      }
      const why = whyNotInBrowser(specifier)
      if (why === undefined) continue
      findings.push({
        file: next,
        line,
        col,
        rule: 'browser-import',
        message: `"${next}" runs in the browser and imports "${specifier}". ${why}\nReached from ${reached.get(next)}.`,
      })
    }
  }
  return { files: [...reached.keys()].sort(), findings }
}
