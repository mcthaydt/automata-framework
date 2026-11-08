import { appendFileSync, cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { entryPoints, HELD_UNTIL_3D_PUBLIC, MissingTypesError, templateImports } from '#src/entry-points.ts'

const repo = fileURLToPath(new URL('../../fixtures/repo', import.meta.url))
const betaRepo = fileURLToPath(new URL('../../fixtures/beta-repo', import.meta.url))
const afRoot = fileURLToPath(new URL('../../../..', import.meta.url))
const unbuilt = fileURLToPath(new URL('../../fixtures/unbuilt', import.meta.url))

describe('entryPoints', () => {
  it("lists each published package's typed entry points, skipping private packages, bins and untyped keys", () => {
    expect(
      entryPoints(repo).map(({ package: name, entryPoint, version }) => ({ name, entryPoint, version })),
    ).toEqual([
      { name: '@fixture/alpha', entryPoint: '.', version: '1.2.3' },
      { name: '@fixture/alpha', entryPoint: './sub', version: '1.2.3' },
    ])
  })

  it('points at the emitted .d.ts', () => {
    expect(entryPoints(repo)[1]?.typesFile).toBe(`${repo}/packages/alpha/types/sub.d.ts`)
  })

  it('fails when a types file is missing, since the index is built from emitted .d.ts after pnpm build', () => {
    expect(() => entryPoints(unbuilt)).toThrow(MissingTypesError)
    expect(() => entryPoints(unbuilt)).toThrow(/@fixture\/beta.*types\/index\.d\.ts.*pnpm build/)
  })
})

describe('beta entry points', () => {
  it('reads the specifiers the 2D and story templates import, and leaves the 3D template files unread', () => {
    expect([...templateImports(betaRepo)].sort()).toEqual([
      '@automata/alpha',
      '@automata/narrative',
      '@automata/narrative/sim',
    ])
  })

  it('lists published entries first, then the private entries a template imports, marked beta', () => {
    expect(
      entryPoints(betaRepo).map(({ package: name, entryPoint, beta, version }) => ({
        name,
        entryPoint,
        beta,
        version,
      })),
    ).toEqual([
      { name: '@automata/alpha', entryPoint: '.', beta: false, version: '1.2.3' },
      { name: '@automata/narrative', entryPoint: '.', beta: true, version: '0.0.0' },
      { name: '@automata/narrative', entryPoint: './sim', beta: true, version: '0.0.0' },
    ])
  })

  it('reads a beta entry from its source file and leaves out entries no template imports', () => {
    const files = entryPoints(betaRepo).map((entry) => entry.typesFile)
    expect(files).toContain(`${betaRepo}/extensions/narrative/src/entries/sim.ts`)
    expect(files.some((file) => file.endsWith('tools.ts'))).toBe(false)
  })

  it('fails when a template imports an entry its private package does not export', () => {
    const copy = mkdtempSync(join(tmpdir(), 'beta-repo-'))
    try {
      cpSync(betaRepo, copy, { recursive: true })
      appendFileSync(
        join(copy, 'packages/tools/src/shared/create-game/template-game.ts'),
        "import { gone } from '@automata/narrative/missing'\n",
      )
      expect(() => entryPoints(copy)).toThrow(MissingTypesError)
      expect(() => entryPoints(copy)).toThrow(/@automata\/narrative\/missing/)
    } finally {
      rmSync(copy, { recursive: true, force: true })
    }
  })

  it("lists every package AF's 2D and story templates import, and holds back the 3D ones", () => {
    const listed = new Set(entryPoints(afRoot).map((entry) => entry.package))
    for (const specifier of templateImports(afRoot)) {
      const name = specifier.split('/').slice(0, 2).join('/')
      if (HELD_UNTIL_3D_PUBLIC.includes(name as never)) expect(listed).not.toContain(name)
      else expect(listed, specifier).toContain(name)
    }
  })

  it('marks the private ones beta and the published ones not', () => {
    const byName = new Map(entryPoints(afRoot).map((entry) => [entry.package, entry]))
    expect(byName.get('@automata/narrative')?.beta).toBe(true)
    expect(byName.get('@automata/sim')?.beta).toBe(false)
    expect(byName.has('@automata/3d')).toBe(false)
  })
})
