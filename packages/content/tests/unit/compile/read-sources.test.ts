import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { readSources } from '#src/compile/read-sources.ts'
import { formatDiagnostic } from '#src/diagnostics/diagnostic.ts'
import { CATALOG, CHARACTER, copyFixture, SONG, STAGE } from '#src/testing/fixture-game.ts'

const schemas = [CHARACTER, SONG, STAGE, CATALOG]

describe('readSources', () => {
  it('reads documents and sorted item files, ignoring non-sources', async () => {
    const root = copyFixture('valid')
    writeFileSync(join(root, 'content/songs/.gitkeep'), '')
    const tree = await Effect.runPromise(readSources(root, schemas))

    expect(tree.documents.get('tuning')?.file).toBe('content/tuning.toml')
    expect(tree.documents.get('catalog')?.file).toBe('content/catalog.toml')
    expect(tree.documents.get('palette')).toBeUndefined()
    expect(tree.collections.get('character')?.map((item) => [item.id, item.source.file])).toEqual([
      ['cyan', 'content/characters/cyan.toml'],
      ['gold', 'content/characters/gold.toml'],
      ['scarlet', 'content/characters/scarlet.toml'],
      ['violet', 'content/characters/violet.toml'],
    ])
    // `.gitkeep` and `*.toml.example` are deliberately outside the glob.
    expect(tree.collections.get('song')?.map((item) => item.id)).toEqual(['dawn-tutorial', 'dusk-run'])
    expect(tree.translations.map((t) => [t.language, t.source.file])).toEqual([
      ['fr', 'content/messages/fr.json'],
    ])
    expect(tree.diagnostics).toEqual([])
  })

  it('gives nested files path IDs and refuses a name that is not an ID', async () => {
    const root = copyFixture('valid')
    mkdirSync(join(root, 'content/songs/night'))
    writeFileSync(join(root, 'content/songs/night/dusk.toml'), '')
    writeFileSync(join(root, 'content/songs/Bad_Name.toml'), '')
    const tree = await Effect.runPromise(readSources(root, schemas))

    expect(tree.collections.get('song')?.map((item) => item.id)).toEqual([
      'dawn-tutorial',
      'dusk-run',
      'night/dusk',
    ])
    expect(tree.diagnostics.map(formatDiagnostic)).toEqual([
      'content/songs/Bad_Name.toml:1:1  invalidId: Bad_Name is not an ID; name files like dusk-run.toml (^[a-z0-9-]+$ per folder)',
    ])
  })

  it('reads an absent folder as an empty collection', async () => {
    const root = copyFixture('equivalent-a')
    const tree = await Effect.runPromise(readSources(root, schemas))
    expect(tree.collections.get('stage')).toEqual([])
    expect(tree.documents.get('catalog')).toBeUndefined()
  })
})
