// The index runs code from other tooling folders by relative path (tooling/api-report's extractor, tooling/release's
// package list). Turbo hashes only the package's own files by default, so each task that runs that code must list
// its folder as an input, or a cached pass is replayed after it changes.
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
 * `$TURBO_ROOT$/tooling/<name>/src/**` for every import of another tooling package's `src/` folder, whether the
 * index's sources or its tests make it. Each specifier is resolved against its file, so moving a file never changes
 * the answer.
 */
function importedToolingSources(): string[] {
  const folders = new Set<string>()
  for (const dir of ['src', 'tests']) {
    for (const file of readdirSync(join(PACKAGE, dir), { recursive: true, encoding: 'utf8' })) {
      if (!file.endsWith('.ts')) continue
      const path = join(PACKAGE, dir, file)
      for (const [, specifier] of readFileSync(path, 'utf8').matchAll(/from '(\.\.?\/[^']+)'/g)) {
        const imported = relative(TOOLING, resolve(dirname(path), specifier ?? '')).split('/')
        if (imported[1] === 'src' && imported[0] !== basename(PACKAGE))
          folders.add(`$TURBO_ROOT$/tooling/${imported[0]}/src/**`)
      }
    }
  }
  return [...folders].sort()
}

describe("the index's turbo inputs", () => {
  it('finds the tooling code the index imports', () => {
    expect(importedToolingSources()).toEqual([
      '$TURBO_ROOT$/tooling/api-report/src/**',
      '$TURBO_ROOT$/tooling/release/src/**',
    ])
  })

  it.each(['typecheck', 'test', 'test:unit'])('%s hashes that code with its own files', (task) => {
    const inputs = turbo.tasks[task]?.inputs ?? []
    expect(inputs).toContain('$TURBO_DEFAULT$')
    expect(inputs).toEqual(expect.arrayContaining(importedToolingSources()))
  })
})
