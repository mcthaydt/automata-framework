// repo-hygiene's tests import code from other tooling folders by relative path (`script-paths.test.ts` reads the
// workspace through tooling/release). Turbo hashes only the package's own files by default, so each task that
// compiles or runs that code must list it as an input, or a cached pass is replayed after it changes. The same
// rule as tooling/api-index's turbo-inputs test.
import { readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const PACKAGE = fileURLToPath(new URL('../..', import.meta.url))
const TOOLING = dirname(PACKAGE)
const turbo = JSON.parse(readFileSync(join(PACKAGE, 'turbo.json'), 'utf8')) as {
  tasks: Record<string, { inputs?: string[] }>
}

/**
 * `$TURBO_ROOT$/tooling/<name>/src/<file>` for every import of another tooling package's source file, from repo-hygiene's
 * sources or tests. Each specifier is resolved against its file, so moving a file never changes the answer.
 */
function importedToolingFiles(): string[] {
  const files = new Set<string>()
  for (const dir of ['src', 'tests']) {
    for (const file of readdirSync(join(PACKAGE, dir), { recursive: true, encoding: 'utf8' })) {
      if (!file.endsWith('.ts')) continue
      const path = join(PACKAGE, dir, file)
      for (const [, specifier] of readFileSync(path, 'utf8').matchAll(/from '(\.\.?\/[^']+)'/g)) {
        const imported = relative(TOOLING, resolve(dirname(path), specifier ?? ''))
        if (/^[a-z-]+\/src\//.test(imported) && !imported.startsWith(`${basename(PACKAGE)}/`))
          files.add(`$TURBO_ROOT$/tooling/${imported}`)
      }
    }
  }
  return [...files].sort()
}

describe("repo-hygiene's turbo inputs", () => {
  it('finds the tooling code repo-hygiene imports', () => {
    expect(importedToolingFiles()).toEqual(['$TURBO_ROOT$/tooling/release/src/publishable-packages.ts'])
  })

  it.each(['typecheck', 'test', 'test:unit'])('%s hashes that code with its own files', (task) => {
    const inputs = turbo.tasks[task]?.inputs ?? []
    expect(inputs).toContain('$TURBO_DEFAULT$')
    expect(inputs).toEqual(expect.arrayContaining(importedToolingFiles()))
  })
})
