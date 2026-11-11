import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { achievementWords } from '#src/shared/words/achievement-words.ts'
import { folderCatalog, gameCatalogs, placeholders, translationProblems } from '#src/shared/words/catalog.ts'
import { memoryFiles } from '#src/testing/memory-files.ts'

// A game's words are message catalogs: flat `key -> text`, a `{name}` where the text needs a name or a number. These
// are the pure parts every `automata words` and `automata check` step shares.

describe('placeholders', () => {
  it('names each {slot} once, sorted, and skips an escaped one', () => {
    expect(placeholders('+{count} more \\{x}')).toEqual(['count'])
    expect(placeholders('{b} then {a} then {b}')).toEqual(['a', 'b'])
    expect(placeholders('Play')).toEqual([])
  })
})

describe('translationProblems', () => {
  it('says what is missing, what is not a source key, and where the placeholders differ', () => {
    expect(translationProblems({ a: 'Hi {name}' }, { a: 'Hola', b: 'x' })).toEqual([
      'a: placeholders (none) are not {name}',
      'b: not a source key',
    ])
  })

  it('passes a translation with the same slots in any order', () => {
    expect(translationProblems({ a: '{x} of {y}' }, { a: '{y} de {x}' })).toEqual([])
  })

  it('does not call a missing translation a problem: missing is its own state', () => {
    expect(translationProblems({ a: 'Hi', b: 'Bye' }, { a: 'Hola' })).toEqual([])
  })
})

describe('folderCatalog', () => {
  it('is one folder of <lang>.json, a context.json and a sources.json', () => {
    const catalog = folderCatalog('/pkg/words', 'en')
    expect(catalog.name).toBe('words')
    expect(catalog.source).toBe('/pkg/words/en.json')
    expect(catalog.context).toBe('/pkg/words/context.json')
    expect(catalog.translation('ja')).toBe('/pkg/words/ja.json')
    expect(catalog.record).toBe('/pkg/words/sources.json')
  })
})

describe('gameCatalogs', () => {
  const run = (files: Record<string, string>, language = 'en') =>
    Effect.runPromise(Effect.provide(gameCatalogs('/g', language), memoryFiles(files).layer))

  it('finds the content catalog and the interface catalog, with the game record at its root', async () => {
    const catalogs = await run({
      '/g/content/generated/messages/en.json': '{}',
      '/g/messages/ui/en.json': '{}',
    })
    expect(catalogs.map((c) => c.name)).toEqual(['content', 'ui'])
    const [content, ui] = catalogs
    expect(content?.source).toBe('/g/content/generated/messages/en.json')
    expect(content?.translation('ja')).toBe('/g/content/messages/ja.json')
    expect(content?.record).toBe('/g/words-sources.json')
    expect(ui?.source).toBe('/g/messages/ui/en.json')
    expect(ui?.translation('ja')).toBe('/g/messages/ui/ja.json')
    expect(ui?.context).toBe('/g/messages/ui/context.json')
    expect(ui?.record).toBe('/g/words-sources.json')
  })

  it('finds the achievements catalog in messages/achievements, recorded in the same game record', async () => {
    const catalogs = await run({ '/g/messages/ui/en.json': '{}', '/g/messages/achievements/en.json': '{}' })
    expect(catalogs.map((c) => c.name)).toEqual(['ui', 'achievements'])
    const achievements = catalogs[1]
    expect(achievements?.source).toBe('/g/messages/achievements/en.json')
    expect(achievements?.translation('ja')).toBe('/g/messages/achievements/ja.json')
    expect(achievements?.record).toBe('/g/words-sources.json')
  })

  it('finds the interface catalog in src/messages/ui when that is where the game keeps it', async () => {
    const catalogs = await run({ '/g/src/messages/ui/en.json': '{}' })
    expect(catalogs.map((c) => c.name)).toEqual(['ui'])
    expect(catalogs[0]?.source).toBe('/g/src/messages/ui/en.json')
  })

  it('prefers messages/ui when both exist', async () => {
    const catalogs = await run({ '/g/messages/ui/en.json': '{}', '/g/src/messages/ui/en.json': '{}' })
    expect(catalogs[0]?.source).toBe('/g/messages/ui/en.json')
  })

  it('has no catalog for a game that has none, and reads the source language it is given', async () => {
    expect(await run({})).toEqual([])
    expect((await run({ '/g/messages/ui/pt-BR.json': '{}' }, 'pt-BR'))[0]?.source).toBe(
      '/g/messages/ui/pt-BR.json',
    )
  })
})

describe('achievementWords', () => {
  it('derives a title and a description key for each achievement, in id order', () => {
    expect(
      achievementWords({
        'top-ten': {
          title: 'Top 10%',
          description: 'Stand in the top tenth.',
          board: 'b',
          goal: { top_percent: 10 },
        },
        'score-20': { title: 'Twenty', description: 'Score 20.', board: 'b', goal: { reach: 20 } },
      }),
    ).toEqual({
      achievement_score_20_title: 'Twenty',
      achievement_score_20_description: 'Score 20.',
      achievement_top_ten_title: 'Top 10%',
      achievement_top_ten_description: 'Stand in the top tenth.',
    })
  })

  it('has no words for a game with no achievements', () => {
    expect(achievementWords(undefined)).toEqual({})
  })
})
