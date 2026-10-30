import { existsSync } from 'node:fs'
import { join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { type WorkspacePackage, workspacePackages } from '../../release/src/publishable-packages.ts'

// A package script that reaches out of its own folder (`check ../../games/emberwick`) breaks without a sound when
// the folder it names moves, and a script nothing calls stays broken: the cli's `check:example` named
// `examples/base-2d` for two weeks after EX.2 moved it (DX.6c). This test holds every such path to one that exists.

const root = fileURLToPath(new URL('../../..', import.meta.url))

interface ScriptsManifest {
  readonly scripts?: Readonly<Record<string, string>>
}

/**
 * The `../` paths in a script, each at the start of a word or after `=` (`--config=../x`). A glob names a
 * pattern, not a path that must exist, so one is left out.
 */
function relativePaths(script: string): string[] {
  const paths = script.match(/(?<=^|[\s='"])(?:\.\.\/)+[^\s'"`;&|)]*/g) ?? []
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
        },
      } as WorkspacePackage['manifest'],
    }
    const exists = (repoPath: string): boolean => repoPath === 'games/real/vite.config.ts'

    expect(missingScriptPaths([planted], exists)).toEqual([
      'packages/a check:example: ../../examples/gone (examples/gone) does not exist',
      'packages/a up: ../../../elsewhere.js is outside the repository',
    ])
  })

  it('finds none in the workspace that resolves to nothing', () => {
    const packages = workspacePackages(root)
    expect(packages.length).toBeGreaterThan(0)
    expect(missingScriptPaths(packages, (repoPath) => existsSync(join(root, repoPath)))).toEqual([])
  })
})
