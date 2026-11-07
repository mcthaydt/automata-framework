import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// DT-a, "never in a game bundle" (M4 spec §12, plan DT-D1): the package has nothing to import. Its manifest exports
// `{}`, so Node, Vite and every resolver that honours `exports` refuse the package name; the two bins are its only
// surface. A Plus package may list it under devDependencies (to run the bins), never where it would ship.

const packageDir = fileURLToPath(new URL('../..', import.meta.url))
const plusRoot = join(packageDir, '..', '..')
const NAME = '@automata/dev-tools'
const readJson = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
const manifest = readJson(join(packageDir, 'package.json'))

const SHIPPED_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies'] as const

/** Each manifest that lists the package where an install or a bundle would carry it. */
function shippedBy(manifests: ReadonlyArray<{ path: string; manifest: Record<string, unknown> }>): string[] {
  return manifests.flatMap(({ path, manifest: m }) =>
    SHIPPED_FIELDS.filter((field) => {
      const map = m[field] as Record<string, string> | undefined
      return map !== undefined && NAME in map
    }).map((field) => `${path}: ${field}`),
  )
}

/** packages/* and each tooling/* workspace package (a folder with its own package.json). */
function plusManifests(): Array<{ path: string; manifest: Record<string, unknown> }> {
  return ['packages', 'tooling'].flatMap((folder) =>
    readdirSync(join(plusRoot, folder), { withFileTypes: true })
      .filter(
        (entry) => entry.isDirectory() && existsSync(join(plusRoot, folder, entry.name, 'package.json')),
      )
      .map((entry) => {
        const path = `${folder}/${entry.name}/package.json`
        return { path, manifest: readJson(join(plusRoot, path)) }
      }),
  )
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourceFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  )
}

describe('DT-a: never in a game bundle', () => {
  it('exports nothing and has no main, module or browser entry', () => {
    expect(manifest.exports).toEqual({})
    for (const field of ['main', 'module', 'browser', 'types'])
      expect(manifest[field], `${field} would give a bundler an entry`).toBeUndefined()
  })

  it('cannot be resolved by name', () => {
    const require = createRequire(join(packageDir, 'package.json'))
    expect(() => require.resolve(NAME)).toThrow(
      expect.objectContaining({ code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' }),
    )
  })

  it('declares exactly the two bins, each a file that exists', () => {
    expect(manifest.bin).toEqual({
      'promote-evidence': './src/bin/promote-evidence.ts',
      'worktree-gc': './src/bin/worktree-gc.ts',
    })
    for (const target of Object.values(manifest.bin as Record<string, string>))
      expect(existsSync(join(packageDir, target)), target).toBe(true)
  })

  it('is listed by no Plus package outside devDependencies', () => {
    expect(shippedBy(plusManifests())).toEqual([])
  })

  it('reports a manifest that would ship it', () => {
    expect(
      shippedBy([
        { path: 'games/a/package.json', manifest: { devDependencies: { [NAME]: '0.0.0' } } },
        { path: 'games/b/package.json', manifest: { dependencies: { [NAME]: '0.0.0' } } },
      ]),
    ).toEqual(['games/b/package.json: dependencies'])
  })
})

describe('DT-i: no bus or orchestrator paths', () => {
  // The Owner ended the bus and the orchestrator on 2026-10-30; nothing here may write to an inbox or a hub.
  const FORBIDDEN = /automata\/inbox|orchestrat|\bhub\b|\bbus\b|test-request/i

  it('names none in its sources', () => {
    const offenders = sourceFiles(join(packageDir, 'src'))
      .filter((file) => !file.endsWith('manifest.test.ts'))
      .filter((file) => FORBIDDEN.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})
