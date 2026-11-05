import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { type RenovateConfig, rukenMatchedNames, unfrozenRukenPins } from '#src/renovate.ts'

// Renovate proposes monthly upgrades (QB spec §4.1), but a pin that matches Ruken's follows Ruken's
// docs/versions.md, never a bot (AGENTS.md, "Ruken first"). These tests hold renovate.json's disabled rule to
// every "Same as Ruken" row in docs/versions.md.

const root = fileURLToPath(new URL('../../../..', import.meta.url))

const doc = [
  '## Runtimes',
  '',
  '| Tool | Version | Date | Why |',
  '|---|---|---|---|',
  '| Node | 24.21.0 | 2026-10-11 | Same as Ruken (R-20) |',
  '',
  '## npm packages',
  '',
  '| Package | Version | Date | Why |',
  '|---|---|---|---|',
  '| `vitest` | 5.0.3 | 2026-10-01 | Same as Ruken: unit and parity test runner |',
  '| `zod` | 4.6.5 | 2026-10-01 | Same as Ruken: the one schema language |',
  '| `koota` | 0.6.6 | 2026-10-01 | ECS inside the sim |',
].join('\n')

describe('rukenMatchedNames', () => {
  it('reads the runtimes and npm rows whose reason says "Same as Ruken"', () => {
    expect(rukenMatchedNames(doc)).toEqual(['node', 'vitest', 'zod'])
  })
})

describe('unfrozenRukenPins', () => {
  it('names a Ruken-matched pin that no disabled rule covers', () => {
    const config: RenovateConfig = {
      packageRules: [
        { matchPackageNames: ['node', 'vitest'], enabled: false },
        { matchPackageNames: ['zod'], groupName: 'zod' },
      ],
    }
    expect(unfrozenRukenPins(doc, config)).toEqual(['zod'])
  })

  it('finds none between docs/versions.md and renovate.json', () => {
    const versions = readFileSync(join(root, 'docs/versions.md'), 'utf8')
    const config = JSON.parse(readFileSync(join(root, 'renovate.json'), 'utf8')) as RenovateConfig
    expect(rukenMatchedNames(versions).length).toBeGreaterThan(10)
    expect(unfrozenRukenPins(versions, config)).toEqual([])
  })
})
