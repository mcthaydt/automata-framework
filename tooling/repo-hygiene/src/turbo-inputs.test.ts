// repo-hygiene's tests import code from other tooling folders by relative path (`script-paths.test.ts` reads the
// workspace through tooling/release). Turbo hashes only the package's own files by default, so each task that
// compiles or runs that code must list it as an input, or a cached pass is replayed after it changes. The same
// rule as tooling/api-index's turbo-inputs test.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('.', import.meta.url))
const turbo = JSON.parse(readFileSync(fileURLToPath(new URL('../turbo.json', import.meta.url)), 'utf8')) as {
  tasks: Record<string, { inputs?: string[] }>
}

/** `$TURBO_ROOT$/tooling/<name>/src/<file>` for every `../../<name>/src/<file>` import in repo-hygiene's sources. */
function importedToolingFiles(): string[] {
  const files = new Set<string>()
  for (const file of readdirSync(SRC, { recursive: true, encoding: 'utf8' })) {
    if (!file.endsWith('.ts')) continue
    for (const [, path] of readFileSync(join(SRC, file), 'utf8').matchAll(
      /from '\.\.\/\.\.\/([a-z-]+\/src\/[^']+)'/g,
    )) {
      files.add(`$TURBO_ROOT$/tooling/${path}`)
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
