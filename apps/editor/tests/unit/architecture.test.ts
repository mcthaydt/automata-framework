import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FRAMEWORK_PREFIX } from '#src/shared/framework-packages.ts'

// The rules of the app's package (apps spec section 4, plan task 2.1) that no linter reads. `pnpm boundaries` checks
// the feature layout; these check what it cannot.

const root = join(import.meta.dirname, '../..')
const src = join(root, 'src')

/** Every file under `folder`, as a path from the package root. */
function filesUnder(folder: string): string[] {
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
}

const sources = filesUnder(src)
const read = (path: string): string => readFileSync(join(root, path), 'utf8')

describe("the app's source", () => {
  it('has only the folders a package has: app, features, shared, entries and testing', () => {
    const folders = new Set(sources.map((path) => path.split('/')[1]))
    expect(
      [...folders].filter(
        (folder) => !['app', 'features', 'shared', 'entries', 'testing'].includes(folder as string),
      ),
    ).toEqual([])
  })

  it('imports @tauri-apps/* only from src/shared/tauri/ (the app is a target adapter: AGENTS.md, host authority)', () => {
    const offenders = sources.filter(
      (path) => !path.startsWith('src/shared/tauri/') && read(path).includes('@tauri-apps/'),
    )
    expect(offenders).toEqual([])
  })

  it('never names FigureBuilder or EnvironmentBuilder (the Owner, 2026-11-08 21:33)', () => {
    const offenders = [...sources, 'package.json'].filter((path) =>
      /FigureBuilder|EnvironmentBuilder/i.test(read(path)),
    )
    expect(offenders).toEqual([])
  })

  it('writes a framework package name only in framework-packages.ts, so a rename is one edit', () => {
    // An import of a workspace package (the editor, the tools) is a dependency of the app, not a name it hands a game.
    const withoutImports = (text: string): string =>
      text.replace(/^(import|export)\b[^;'"]*?from\s+'[^']*'/gm, '').replace(/^import\s+'[^']*'/gm, '')
    const offenders = sources.filter(
      (path) =>
        path !== 'src/shared/framework-packages.ts' && withoutImports(read(path)).includes(FRAMEWORK_PREFIX),
    )
    expect(offenders).toEqual([])
  })

  it('derives no origin with new URL(...).origin, which is "null" for a custom scheme', () => {
    const offenders = sources.filter((path) => /new URL\([^)]*\)\.origin/.test(read(path)))
    expect(offenders).toEqual([])
  })
})
