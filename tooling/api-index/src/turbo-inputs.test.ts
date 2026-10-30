// The index runs code from other tooling folders by relative path (tooling/api-report's extractor, tooling/release's
// package list). Turbo hashes only the package's own files by default, so each task that runs that code must list
// its folder as an input, or a cached pass is replayed after it changes.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('.', import.meta.url))
const turbo = JSON.parse(readFileSync(fileURLToPath(new URL('../turbo.json', import.meta.url)), 'utf8')) as {
  tasks: Record<string, { inputs?: string[] }>
}

/** `$TURBO_ROOT$/tooling/<name>/src/**` for every `../../<name>/src/` import in the index's sources. */
function importedToolingSources(): string[] {
  const folders = new Set<string>()
  for (const file of readdirSync(SRC, { recursive: true, encoding: 'utf8' })) {
    if (!file.endsWith('.ts')) continue
    for (const [, name] of readFileSync(join(SRC, file), 'utf8').matchAll(
      /from '\.\.\/\.\.\/([a-z-]+)\/src\//g,
    )) {
      folders.add(`$TURBO_ROOT$/tooling/${name}/src/**`)
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
