import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { publishablePackages, type WorkspacePackage, workspacePackages } from '#src/publishable-packages.ts'

// What AF publishes to GitHub Packages, and how (M2.4 spec §3.1, §3.2, §3.4). Changing the list is a deliberate
// act: an example, `render-pixi3d` (D-1) or a tool marked publishable fails here before anything is released.
// Physics is an Automata Plus extension and publishes from automata-plus (PRODUCT.5g).
const root = fileURLToPath(new URL('../../../..', import.meta.url))
const published = publishablePackages(root)

// Core and 2D refactor, D1 and U6: four packages (sim, content, automata, tools); the boundaries checker is in tools.
const EXPECTED: readonly string[] = [
  '@mcthaydt/automata',
  '@mcthaydt/automata-content',
  '@mcthaydt/automata-sim',
  '@mcthaydt/automata-tools',
]

const REGISTRY = 'https://npm.pkg.github.com'

/** `.changeset/config.json`'s fixed groups: package names, or patterns where `*` matches any characters. */
const changesets = JSON.parse(readFileSync(join(root, '.changeset/config.json'), 'utf8')) as {
  fixed: readonly (readonly string[])[]
}
const fixedPatterns = changesets.fixed
  .flat()
  .map((pattern) => new RegExp(`^${pattern.split('*').map(escapeRegExp).join('.*')}$`))

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
}

/** Every file path a conditional export points at (`{ types, import, svelte }` or a plain string). */
function targets(entry: unknown): string[] {
  if (typeof entry === 'string') return [entry]
  if (entry !== null && typeof entry === 'object') return Object.values(entry).flatMap(targets)
  return []
}

/** `from './x'`, `import './x'` and `import('./x')`. */
const RELATIVE_IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"](\.{1,2}\/[^'"]*)['"]/g

/**
 * The text of `code` without its comment lines (a line whose first characters are `*`, `/*` or `//`), so a doc
 * comment's example (runtime's "`import * as m from './paraglide/messages.js'`", DX.2a) is not taken for an import.
 * A multi-line import keeps its `} from '…'` line, which is code.
 */
const withoutCommentLines = (code: string): string =>
  code
    .split('\n')
    .filter((line) => !/^\s*(?:\*|\/\*|\/\/)/.test(line))
    .join('\n')

/**
 * `code` with the text of its template literals emptied, so the files `create-game` writes (a template holds
 * `import … from './commands.ts'`, which belongs to the new game, not to this package) are not taken for imports.
 */
const withoutTemplateText = (code: string): string => code.replace(/`(?:\\[\s\S]|[^`\\])*`/g, '``')

const each = (test: (pkg: WorkspacePackage) => void) => () => {
  for (const pkg of published) test(pkg)
}

// EX-D1: the games sit in `games/`, private, so the walk must find them to prove they stay unpublished.
it('walks every workspace folder, games included', () => {
  const dirs = workspacePackages(root).map((pkg) => pkg.dir)
  expect(dirs).toEqual(expect.arrayContaining(['games/emberwick', 'examples/ui/primitives']))
})

describe('the published packages', () => {
  it('are exactly the M2.4 list', () => {
    expect(published.map((pkg) => pkg.manifest.name).sort()).toEqual(EXPECTED)
  })

  it('share one version (the Changesets fixed group)', () => {
    expect(new Set(published.map((pkg) => pkg.manifest.version)).size).toBe(1)
  })

  // `@mcthaydt/automata-*` does not match the umbrella `@mcthaydt/automata` (DX.2a): a package outside the group
  // would be versioned on its own and leave the shared version.
  it(
    'are each in the Changesets fixed group',
    each(({ manifest }) => {
      expect(
        fixedPatterns.some((pattern) => pattern.test(manifest.name)),
        manifest.name,
      ).toBe(true)
    }),
  )

  // `./no-eval` is a game's first import, for its side effects only (AGENTS.md); with `sideEffects` an array, a
  // bundler drops any import of a file the array does not name, so the published file must be named too.
  it(
    'keep the published no-eval entry a side effect',
    each(({ manifest }) => {
      const noEval = (manifest.publishConfig?.exports as Record<string, unknown> | undefined)?.['./no-eval']
      const sideEffects = (manifest as { sideEffects?: boolean | readonly string[] }).sideEffects
      if (noEval === undefined || !Array.isArray(sideEffects)) return
      for (const target of targets(noEval).filter((file) => file.endsWith('.js'))) {
        expect(sideEffects, manifest.name).toContain(target)
      }
    }),
  )

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
    "accept a caret range of each outside peer, so a game's own Svelte or Vite patch release still satisfies it",
    each(({ manifest }) => {
      const exact = Object.entries(manifest.peerDependencies ?? {})
        .filter(([name]) => !name.startsWith('@mcthaydt/'))
        .filter(([, range]) => !range.startsWith('^'))
      expect(exact, manifest.name).toEqual([])
    }),
  )

  it(
    'are MIT licensed (the Owner, 2026-10-15; LICENSE-SCOPE.md)',
    each(({ manifest }) => {
      expect((manifest as { license?: string }).license, manifest.name).toBe('MIT')
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

  // Entries only this repository's tooling and tests import (U1): in `exports`, not in `publishConfig.exports`.
  const WORKSPACE_ONLY: Readonly<Record<string, readonly string[]>> = {
    '@mcthaydt/automata-tools': ['./internal', './e2e'],
  }

  it(
    'publish the same export keys as the workspace, except its workspace-only entries, pointing into dist',
    each(({ manifest }) => {
      const workspaceOnly = WORKSPACE_ONLY[manifest.name] ?? []
      expect(Object.keys(manifest.publishConfig?.exports ?? {}), manifest.name).toEqual(
        Object.keys(manifest.exports ?? {}).filter((key) => !workspaceOnly.includes(key)),
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

/**
 * A Svelte rune call: `$state(`, `$state.raw(`, `$derived(`, `$effect(`, `$props(`. Only a module named
 * `*.svelte.js` is compiled by a game's Svelte plugin, so a rune anywhere else throws when the game runs.
 */
const RUNE_CALL = /(?<![\w$])\$(?:state|derived|effect|props|bindable|inspect|host)(?:\.\w+)?\(/

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

  // DX.2a: runtime's rune modules (`boot/page-layers.svelte.ts`, `display/display-policy.svelte.ts`) must stay
  // files of their own; a bundle that inlines them into `index.js` builds, but the game fails at boot.
  it(
    'keep every Svelte rune in a *.svelte.js module, the only JavaScript a game compiles with Svelte',
    each(({ dir, manifest }) => {
      const offenders = filesBelow(join(root, dir, 'dist'))
        .filter((file) => file.endsWith('.js') && !file.endsWith('.svelte.js'))
        .filter((file) => !file.includes('/dist/vendor/'))
        .filter((file) => RUNE_CALL.test(readFileSync(file, 'utf8')))
      expect(offenders, manifest.name).toEqual([])
    }),
  )

  it(
    "name a file in every relative import, as Node's loader and nodenext types require",
    each(({ dir, manifest }) => {
      const unresolved: string[] = []
      for (const file of filesBelow(join(root, dir, 'dist'))) {
        if (!/\.(js|d\.ts)$/.test(file) || file.includes('/dist/vendor/')) continue
        for (const [, specifier] of withoutTemplateText(
          withoutCommentLines(readFileSync(file, 'utf8')),
        ).matchAll(RELATIVE_IMPORT)) {
          const target = join(dirname(file), specifier as string)
          // A `.js` import resolves to its `.d.ts` in a declaration file.
          const exists = existsSync(target) || existsSync(target.replace(/\.js$/, '.d.ts'))
          if (!exists || !/\.(js|svelte|css)$/.test(specifier as string))
            unresolved.push(`${file}: ${specifier}`)
        }
      }
      expect(unresolved, manifest.name).toEqual([])
    }),
  )
})
