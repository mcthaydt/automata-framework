import { existsSync, readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { type WorkspacePackage, workspacePackages } from '../../../release/src/publishable-packages.ts'

// A package script that reaches out of its own folder (`check ../../games/emberwick`) breaks without a sound when
// the folder it names moves, and a script nothing calls stays broken: the cli's `check:example` named
// `examples/emberwick` for two weeks after EX.2 moved it (DX.6c). This test holds every such path to one that exists.

const root = fileURLToPath(new URL('../../../..', import.meta.url))

interface ScriptsManifest {
  readonly scripts?: Readonly<Record<string, string>>
}

/**
 * The `../` paths in a script, each at the start of a word, after `=` (`--config=../x`), after `(` (`$(../x)`)
 * or in a comma-joined list (`--files=../a,../b`). A glob names a pattern, not a path that must exist, so one is
 * left out.
 */
function relativePaths(script: string): string[] {
  const paths = script.match(/(?<=^|[\s='"(,])(?:\.\.\/)+[^\s'"`;&|(),]*/g) ?? []
  return paths.filter((path) => !/[*?[{]/.test(path))
}

/** `<package folder> <script>: <path> …` for each `../` path that resolves to nothing or leaves the repository. */
function missingScriptPaths(
  packages: readonly WorkspacePackage[],
  exists: (repoPath: string) => boolean,
): string[] {
  const problems: string[] = []
  for (const { dir, manifest } of packages) {
    const scripts = (manifest as ScriptsManifest).scripts ?? {}
    for (const [name, script] of Object.entries(scripts)) {
      for (const path of relativePaths(script)) {
        // A path from the package folder, as the script runs there, made relative to the repository root.
        const repoPath = posix.join(dir, path)
        if (repoPath === '..' || repoPath.startsWith('../')) {
          problems.push(`${dir} ${name}: ${path} is outside the repository`)
        } else if (!exists(repoPath)) {
          problems.push(`${dir} ${name}: ${path} (${repoPath}) does not exist`)
        }
      }
    }
  }
  return problems
}

describe('package scripts that name a folder outside their package', () => {
  it('names a path that resolves to nothing or leaves the repository, and passes paths that exist and globs', () => {
    // `sub` and `roots` (DX.6c1): a path after `(` and each path in a comma-joined list are paths too.
    const planted: WorkspacePackage = {
      dir: 'packages/a',
      manifest: {
        name: 'a',
        version: '0.0.0',
        scripts: {
          'check:example': 'node src/bin.ts check ../../examples/gone --csp',
          'e2e:host': 'vite build --config=../../games/real/vite.config.ts && echo done',
          'build:all': 'tsc -p ../../examples/*/tsconfig.json',
          up: "node '../../../elsewhere.js'",
          local: 'node src/bin.ts',
          sub: 'echo $(../../games/gone-sub/version.sh)',
          roots: 'tsc --files=../../games/real/vite.config.ts,../../games/gone-joined',
        },
      } as WorkspacePackage['manifest'],
    }
    const exists = (repoPath: string): boolean => repoPath === 'games/real/vite.config.ts'

    expect(missingScriptPaths([planted], exists)).toEqual([
      'packages/a check:example: ../../examples/gone (examples/gone) does not exist',
      'packages/a up: ../../../elsewhere.js is outside the repository',
      'packages/a sub: ../../games/gone-sub/version.sh (games/gone-sub/version.sh) does not exist',
      'packages/a roots: ../../games/gone-joined (games/gone-joined) does not exist',
    ])
  })

  it('finds none in the workspace that resolves to nothing', () => {
    const packages = workspacePackages(root)
    expect(packages.length).toBeGreaterThan(0)
    expect(missingScriptPaths(packages, (repoPath) => existsSync(join(root, repoPath)))).toEqual([])
  })
})

// A script that runs one test file by path (`vitest run tests/browser/golden.test.ts`) finds "No test files" when the
// file moves, and fails only where the script runs: `pnpm evidence` in CI's parity job was red for days after
// "lay the game out by feature" moved emberwick's golden test, hidden behind other failures.

/**
 * The test files a script names: a word ending `.test.` or `.spec.` and a script extension, after a space, `=`,
 * a quote or a comma. A glob is a pattern, not a file that must exist, so one is left out.
 */
function testFilePaths(script: string): string[] {
  const paths =
    script.match(/(?<=^|[\s='"(,])[^\s'"`;&|(),=]+\.(?:test|spec)\.[cm]?[jt]sx?(?=$|[\s'"`;&|),])/g) ?? []
  return paths.filter((path) => !/[*?[{]/.test(path))
}

/** `<package folder> <script>: <path> …` for each test file path a script names that is not on disk. */
function missingTestFiles(
  packages: readonly WorkspacePackage[],
  exists: (repoPath: string) => boolean,
): string[] {
  const problems: string[] = []
  for (const { dir, manifest } of packages) {
    const scripts = (manifest as ScriptsManifest).scripts ?? {}
    for (const [name, script] of Object.entries(scripts)) {
      for (const path of testFilePaths(script)) {
        const repoPath = posix.join(dir, path)
        if (!exists(repoPath)) problems.push(`${dir} ${name}: ${path} (${repoPath}) does not exist`)
      }
    }
  }
  return problems
}

describe('package scripts that name a test file', () => {
  it('names a test file that is not on disk, and passes one that is, a glob, and a word that is not a path', () => {
    const planted: WorkspacePackage = {
      dir: 'games/a',
      manifest: {
        name: 'a',
        version: '0.0.0',
        scripts: {
          'test:evidence':
            'vitest run --project unit tests/browser/golden.test.ts tests/browser/testing/golden.test.ts --outputFile.json=.evidence/goldens.json',
          'test:one': "vitest run 'tests/unit/real.spec.ts' && vitest run --dir=tests/unit/gone.test.mts",
          'test:all': 'vitest run tests/unit/*.test.ts',
          build: 'tsc -p . && echo "see foo.test.ts later"',
          local: 'node src/bin.ts',
        },
      } as WorkspacePackage['manifest'],
    }
    const exists = (repoPath: string): boolean =>
      repoPath === 'games/a/tests/browser/testing/golden.test.ts' ||
      repoPath === 'games/a/tests/unit/real.spec.ts'

    expect(missingTestFiles([planted], exists)).toEqual([
      'games/a test:evidence: tests/browser/golden.test.ts (games/a/tests/browser/golden.test.ts) does not exist',
      'games/a test:one: tests/unit/gone.test.mts (games/a/tests/unit/gone.test.mts) does not exist',
      'games/a build: foo.test.ts (games/a/foo.test.ts) does not exist',
    ])
  })

  it('finds none in the workspace or the root that is not on disk', () => {
    const rootPackage: WorkspacePackage = {
      dir: '.',
      manifest: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as WorkspacePackage['manifest'],
    }
    const packages = [rootPackage, ...workspacePackages(root)]
    expect(missingTestFiles(packages, (repoPath) => existsSync(join(root, repoPath)))).toEqual([])
  })
})
