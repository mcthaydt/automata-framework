import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { compileContent } from '#src/shared/compile/compile-content.ts'
import { compileContentFiles } from '#src/shared/compile/compile-tree.ts'
import { contentModuleText } from '#src/shared/compile/content-module.ts'
import { sourceTreeFrom } from '#src/shared/compile/source-tree.ts'
import { formatDiagnostic } from '#src/shared/diagnostics/diagnostic.ts'
import { copyFixture, fixtureOptions } from '#src/testing/fixture-game.ts'

/** Every file below `root` as the page would hold it: project-relative path to text. */
function readTree(root: string): Map<string, string> {
  const files = new Map<string, string>()
  for (const entry of readdirSync(root, { recursive: true, withFileTypes: true }))
    if (entry.isFile()) {
      const path = join(entry.parentPath, entry.name)
      files.set(path.slice(root.length + 1).replaceAll('\\', '/'), readFileSync(path, 'utf8'))
    }
  return files
}

const { root: _root, ...pureOptions } = fixtureOptions('')

describe('compileContentFiles: the compile with no disk and no Effect', () => {
  it('gives the same hash, sim hash and outputs as the compile from disk', async () => {
    const root = copyFixture('valid')
    const fromDisk = await Effect.runPromise(compileContent(fixtureOptions(root)))
    const result = compileContentFiles(readTree(root), pureOptions)
    if (!result.ok) throw new Error(result.diagnostics.map(formatDiagnostic).join('\n'))
    expect(result.content.hash).toBe(fromDisk.hash)
    expect(result.content.sim.hash).toBe(fromDisk.sim.hash)
    expect([...result.content.files]).toEqual([...fromDisk.files])
    expect(result.content.languages).toEqual(fromDisk.languages)
    expect([...result.content.warnings]).toEqual([...fromDisk.warnings])
  })

  it('reports the same diagnostics as the compile from disk when a file is broken', async () => {
    const root = copyFixture('valid')
    writeFileSync(join(root, 'content/songs/broken.toml'), 'bpm = "fast"\n')
    const fromDisk = await Effect.runPromise(Effect.either(compileContent(fixtureOptions(root))))
    if (Either.isRight(fromDisk) || fromDisk.left._tag !== 'ContentCompileFailed')
      throw new Error('expected the compile to fail')
    const result = compileContentFiles(readTree(root), pureOptions)
    if (result.ok) throw new Error('expected the compile to fail')
    expect(result.diagnostics.map(formatDiagnostic)).toEqual(fromDisk.left.diagnostics.map(formatDiagnostic))
  })

  it("says what is wrong with the game's own options, with no file read", () => {
    const result = compileContentFiles(new Map(), { ...pureOptions, outDir: '../elsewhere' })
    if (result.ok || result.diagnostics.length > 0) throw new Error('expected a config problem')
    expect(result.configProblems.join(' ')).toContain('outDir ../elsewhere must be a relative folder')
  })

  it('writes the text of virtual:automata/content: the content, its hash, and what the sim receives', async () => {
    const root = copyFixture('valid')
    const result = compileContentFiles(readTree(root), pureOptions)
    if (!result.ok) throw new Error('expected a compile')
    const text = contentModuleText(result.content)
    expect(text).toContain(`export const content = ${result.content.files.get('content.json')}`)
    expect(text).toContain(`export const contentHash = ${JSON.stringify(result.content.hash)}`)
    expect(text).toContain(`export const simContentHash = ${JSON.stringify(result.content.sim.hash)}`)
    expect(text).toMatch(/export const simContent = \{ .*\}/)
    expect(text.endsWith('\n')).toBe(true)
  })
})

describe('sourceTreeFrom', () => {
  const files = new Map([
    ['content/songs/b.toml', 'x = 1'],
    ['content/songs/a.toml', 'x = 1'],
    ['content/songs/README.md', ''],
    ['content/messages/fr.json', '{}'],
    ['content/game.toml', ''],
    ['src/main.ts', 'ignored'],
  ])
  const song = fixtureOptions('').schemas.find(({ kind }) => kind === 'song')
  if (song === undefined) throw new Error('the fixture has no song kind')

  it('lists a folder sorted, warns about a misnamed file, and ignores what is not content', () => {
    const tree = sourceTreeFrom(files, [song])
    expect(tree.collections.get('song')?.map(({ id }) => id)).toEqual(['a', 'b'])
    expect(tree.warnings.map(({ file }) => file)).toEqual(['content/songs/README.md'])
    expect(tree.translations.map(({ language }) => language)).toEqual(['fr'])
    expect(tree.documents.get('game')?.file).toBe('content/game.toml')
  })
})
