import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { publishablePackages, type WorkspacePackage } from './publishable-packages.ts'

// What AF publishes to GitHub Packages, and how (M2.4 spec §3.1, §3.2, §3.4). Changing the list is a deliberate
// act: an example, `render-pixi3d` (D-1) or a tool marked publishable fails here before anything is released.
const root = fileURLToPath(new URL('../../..', import.meta.url))
const published = publishablePackages(root)

const EXPECTED: readonly string[] = [
  '@mcthaydt/automata-check-boundaries',
  '@mcthaydt/automata-content',
  '@mcthaydt/automata-host',
  '@mcthaydt/automata-node',
  '@mcthaydt/automata-physics',
  '@mcthaydt/automata-ship',
  '@mcthaydt/automata-sim',
  '@mcthaydt/automata-testing',
  '@mcthaydt/automata-ui',
]

const REGISTRY = 'https://npm.pkg.github.com'

/** Every file path a conditional export points at (`{ types, import, svelte }` or a plain string). */
function targets(entry: unknown): string[] {
  if (typeof entry === 'string') return [entry]
  if (entry !== null && typeof entry === 'object') return Object.values(entry).flatMap(targets)
  return []
}

const each = (test: (pkg: WorkspacePackage) => void) => () => {
  for (const pkg of published) test(pkg)
}

describe('the published packages', () => {
  it('are exactly the M2.4 list', () => {
    expect(published.map((pkg) => pkg.manifest.name).sort()).toEqual(EXPECTED)
  })

  it('share one version (the Changesets fixed group)', () => {
    expect(new Set(published.map((pkg) => pkg.manifest.version)).size).toBe(1)
  })

  it(
    'never depend on a vendored file: tarball at runtime (D-8: Ruken code is bundled, never referenced)',
    each(({ manifest }) => {
      const fileDeps = Object.entries(manifest.dependencies ?? {}).filter(([, spec]) =>
        spec.startsWith('file:'),
      )
      expect(fileDeps, manifest.name).toEqual([])
      expect(
        Object.keys(manifest.peerDependencies ?? {}).filter((name) => name.startsWith('@ruken/')),
      ).toEqual([])
    }),
  )

  it(
    'ship only dist (and VENDORED.md), to GitHub Packages',
    each(({ manifest }) => {
      expect(manifest.files, manifest.name).toContain('dist')
      expect(manifest.publishConfig?.registry, manifest.name).toBe(REGISTRY)
    }),
  )

  it(
    "name this repository, so the release job's GITHUB_TOKEN may publish them (GitHub links a package by it)",
    each(({ dir, manifest }) => {
      expect(manifest.repository, manifest.name).toEqual({
        type: 'git',
        url: 'git+https://github.com/mcthaydt/automata-framework.git',
        directory: dir,
      })
    }),
  )

  it(
    'publish the same export keys as the workspace, pointing into dist',
    each(({ manifest }) => {
      expect(Object.keys(manifest.publishConfig?.exports ?? {}), manifest.name).toEqual(
        Object.keys(manifest.exports ?? {}),
      )
      for (const target of Object.values(manifest.publishConfig?.exports ?? {}).flatMap(targets)) {
        expect(target, manifest.name).toMatch(/^\.\/dist\//)
      }
    }),
  )

  it(
    'publish every bin from dist/*.js',
    each(({ manifest }) => {
      expect(Object.keys(manifest.publishConfig?.bin ?? {}), manifest.name).toEqual(
        Object.keys(manifest.bin ?? {}),
      )
      for (const target of Object.values(manifest.publishConfig?.bin ?? {})) {
        expect(target, manifest.name).toMatch(/^\.\/dist\/[\w./-]+\.js$/)
      }
    }),
  )
})

// The built output, checked after `pnpm build` (`pnpm --filter @mcthaydt/release test:dist`, run by CI's checks
// job). `pnpm check` does not build, so these are skipped there.
function filesBelow(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
}

/** An import or re-export of a Ruken package: `from '@ruken/…'`, `import('@ruken/…')`, `import '@ruken/…'`. */
const RUKEN_SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]@ruken\//

describe.skipIf(process.env.AF_CHECK_DIST !== '1')('the built packages', () => {
  it(
    'have every file publishConfig names',
    each(({ dir, manifest }) => {
      const named = [
        ...Object.values(manifest.publishConfig?.exports ?? {}).flatMap(targets),
        ...Object.values(manifest.publishConfig?.bin ?? {}),
      ]
      expect(
        named.filter((file) => !existsSync(join(root, dir, file))),
        manifest.name,
      ).toEqual([])
    }),
  )

  it(
    'start every bin with a node shebang',
    each(({ dir, manifest }) => {
      for (const file of Object.values(manifest.publishConfig?.bin ?? {})) {
        expect(readFileSync(join(root, dir, file), 'utf8').split('\n')[0], `${manifest.name} ${file}`).toBe(
          '#!/usr/bin/env node',
        )
      }
    }),
  )

  it(
    'never import @ruken/* from published JavaScript or declarations (D-8)',
    each(({ dir, manifest }) => {
      const offenders = filesBelow(join(root, dir, 'dist'))
        .filter((file) => /\.(js|d\.ts|svelte)$/.test(file))
        .filter((file) => !file.includes('/dist/vendor/')) // ship's copy of the Ruken CLI is Ruken's own build
        .filter((file) => RUKEN_SPECIFIER.test(readFileSync(file, 'utf8')))
      expect(offenders, manifest.name).toEqual([])
    }),
  )
})
