import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import type { CliIo } from '#src/app/cli-io.ts'
import { ShipConfigLoader } from '#src/shared/node/ship-config-loader.ts'
import { runWords } from '#src/shared/words/run-words.ts'
import { sourceHash } from '#src/shared/words/sources.ts'
import { parseWordsArgs, type WordsOptions } from '#src/shared/words/words-args.ts'
import { type TranslationRequest, WordsModel, WordsModelUnavailable } from '#src/shared/words/words-model.ts'
import { memoryFiles } from '#src/testing/memory-files.ts'

// `automata words`: an AI translates every missing or stale word into every language the game ships. These run it over
// an in-memory `Files`, a fake translator that answers from a table, and a fake ship config.

const SCHEMA = 'https://inlang.com/schema/inlang-message-format'
const json = (value: Record<string, string>) => `${JSON.stringify({ $schema: SCHEMA, ...value }, null, 2)}\n`

interface Setup {
  readonly files?: Record<string, string>
  readonly languages?: readonly string[]
  readonly answers?: (request: TranslationRequest) => string | undefined
  readonly key?: boolean
  /** The achievements `ship.config.ts` declares, when the game has any. */
  readonly achievements?: Record<string, { title: string; description: string }>
}

async function run(args: readonly string[], setup: Setup = {}) {
  const memory = memoryFiles(setup.files ?? {})
  const requests: TranslationRequest[] = []
  const out: string[] = []
  const err: string[] = []
  const io: CliIo = { stdout: (m) => out.push(m), stderr: (m) => err.push(m) }
  const model = Layer.succeed(WordsModel, {
    check: () =>
      setup.key === false ? Effect.fail(new WordsModelUnavailable({ reason: 'no-key' })) : Effect.void,
    translate: (request) => {
      requests.push(request)
      const answer = (setup.answers ?? ((r) => `[${r.lang}] ${r.source}`))(request)
      return answer === undefined
        ? Effect.fail(new WordsModelUnavailable({ reason: 'offline' }))
        : Effect.succeed(answer)
    },
  })
  const config = Layer.succeed(ShipConfigLoader, {
    load: () =>
      Effect.succeed({
        content: { languages: setup.languages ?? ['en', 'ja'] },
        ...(setup.achievements === undefined ? {} : { achievements: setup.achievements }),
      } as never),
  })
  const parsed = parseWordsArgs(args)
  if (!parsed.ok) throw new Error(parsed.problem)
  const code = await Effect.runPromise(
    Effect.provide(runWords(parsed.options as WordsOptions, io), Layer.mergeAll(memory.layer, model, config)),
  )
  return { code, files: memory.files, requests, out: out.join(''), err: err.join('') }
}

const GAME = '/g'
const UI = `${GAME}/messages/ui`
const base = { [`${UI}/en.json`]: json({ play: 'Play', more: '+{count} more' }) }

describe('runWords: achievements', () => {
  const achievements = { 'score-20': { title: 'Twenty', description: 'Score 20.' } }

  it('writes the achievements source from ship.config.ts, then translates it like any catalog', async () => {
    const result = await run(['--dir', GAME], { achievements })
    const source = JSON.parse(result.files.get(`${GAME}/messages/achievements/en.json`) ?? '{}')
    expect(source).toEqual({
      $schema: SCHEMA,
      achievement_score_20_title: 'Twenty',
      achievement_score_20_description: 'Score 20.',
    })
    expect(result.requests.map((r) => `${r.lang}:${r.key}`).sort()).toEqual([
      'ja:achievement_score_20_description',
      'ja:achievement_score_20_title',
    ])
    expect(JSON.parse(result.files.get(`${GAME}/messages/achievements/ja.json`) ?? '{}')).toMatchObject({
      achievement_score_20_title: '[ja] Twenty',
    })
  })

  it('follows a changed title: the source is rewritten and the old translation is stale', async () => {
    const first = await run(['--dir', GAME], { achievements })
    const second = await run(['--dir', GAME], {
      achievements: { 'score-20': { title: 'Twenty points', description: 'Score 20.' } },
      files: Object.fromEntries(first.files),
    })
    expect(
      JSON.parse(second.files.get(`${GAME}/messages/achievements/en.json`) ?? '{}')
        .achievement_score_20_title,
    ).toBe('Twenty points')
    expect(second.requests.map((r) => r.key)).toEqual(['achievement_score_20_title'])
  })

  it('a game with no achievements gets no achievements catalog', async () => {
    const result = await run(['--dir', GAME], { files: base })
    expect(result.files.has(`${GAME}/messages/achievements/en.json`)).toBe(false)
  })

  it('--catalog never reads ship.config.ts, so it writes no achievements source', async () => {
    const result = await run(['--catalog', `${GAME}/messages/ui`], { files: base, achievements })
    expect(result.files.has(`${GAME}/messages/achievements/en.json`)).toBe(false)
  })
})

describe('runWords', () => {
  it('translates every missing and stale word into every shipped language, and records their sources', async () => {
    const result = await run(
      [GAME].flatMap((dir) => ['--dir', dir]),
      {
        files: { ...base, [`${UI}/ja.json`]: json({ play: 'Old' }) },
        languages: ['en', 'ja', 'ko'],
      },
    )
    expect(result.code).toBe(0)
    // ja has `play` with no record (stale) and lacks `more`; ko has neither: three words are translated in ja and ko.
    expect(result.requests.map((r) => `${r.lang}:${r.key}`).sort()).toEqual([
      'ja:more',
      'ja:play',
      'ko:more',
      'ko:play',
    ])
    expect(JSON.parse(result.files.get(`${UI}/ja.json`) ?? '{}')).toEqual({
      $schema: SCHEMA,
      play: '[ja] Play',
      more: '[ja] +{count} more',
    })
    const record = JSON.parse(result.files.get(`${GAME}/words-sources.json`) ?? '{}')
    expect(record.ui.ja.play).toBe(sourceHash('Play'))
    expect(record.ui.ko.more).toBe(sourceHash('+{count} more'))
    expect(result.out).toContain('ja: 2 translated')
    expect(result.out).toContain('ko: 2 translated')
  })

  it('writes the file with $schema first, keys in source order and a final newline', async () => {
    const result = await run(['--dir', GAME], { files: base })
    const text = result.files.get(`${UI}/ja.json`) ?? ''
    expect(text.endsWith('\n')).toBe(true)
    expect(Object.keys(JSON.parse(text))).toEqual(['$schema', 'play', 'more'])
  })

  it('--to ja translates into ja alone', async () => {
    const result = await run(['--dir', GAME, '--to', 'ja'], { files: base, languages: ['en', 'ja', 'ko'] })
    expect(new Set(result.requests.map((r) => r.lang))).toEqual(new Set(['ja']))
  })

  it('a key translates that one line into every language; with --to, into one', async () => {
    const files = { ...base, [`${UI}/ja.json`]: json({ play: 'x', more: 'y' }) }
    const all = await run(['play', '--dir', GAME], { files, languages: ['en', 'ja', 'ko'] })
    expect(all.requests.map((r) => `${r.lang}:${r.key}`).sort()).toEqual(['ja:play', 'ko:play'])
    const one = await run(['play', '--dir', GAME, '--to', 'ko'], { files, languages: ['en', 'ja', 'ko'] })
    expect(one.requests.map((r) => `${r.lang}:${r.key}`)).toEqual(['ko:play'])
  })

  it('an unknown key is a usage error naming the nearest keys, and calls no model', async () => {
    const result = await run(['pla', '--dir', GAME], { files: base })
    expect(result.code).toBe(2)
    expect(result.err).toContain('play')
    expect(result.requests).toEqual([])
  })

  it('--all retranslates words that already have a translation', async () => {
    const files = {
      ...base,
      [`${UI}/ja.json`]: json({ play: 'a', more: 'b' }),
      [`${GAME}/words-sources.json`]: JSON.stringify({
        ui: { ja: { play: sourceHash('Play'), more: sourceHash('+{count} more') } },
      }),
    }
    expect((await run(['--dir', GAME], { files })).requests).toEqual([])
    expect((await run(['--dir', GAME, '--all', '--to', 'ja'], { files })).requests).toHaveLength(2)
  })

  it('an answer that drops a placeholder is asked for again once, then reported and not written', async () => {
    let calls = 0
    const result = await run(['more', '--dir', GAME, '--to', 'ja'], {
      files: base,
      answers: () => {
        calls += 1
        return 'sin marcador'
      },
    })
    expect(calls).toBe(2)
    expect(result.code).toBe(1)
    expect(result.err).toContain('ja "more"')
    expect(result.err).toContain('{count}')
    expect(result.files.has(`${UI}/ja.json`)).toBe(false)
    expect(result.out).toContain('ja: 0 translated, 1 not')
  })

  it('takes the second answer when the first dropped a placeholder', async () => {
    let calls = 0
    const result = await run(['more', '--dir', GAME, '--to', 'ja'], {
      files: base,
      answers: () => (++calls === 1 ? 'nope' : '+{count} más'),
    })
    expect(result.code).toBe(0)
    expect(JSON.parse(result.files.get(`${UI}/ja.json`) ?? '{}').more).toBe('+{count} más')
  })

  it('writes nothing for a word whose answer is empty', async () => {
    const result = await run(['play', '--dir', GAME, '--to', 'ja'], { files: base, answers: () => '  ' })
    expect(result.code).toBe(1)
    expect(result.files.has(`${UI}/ja.json`)).toBe(false)
  })

  it('reports a translator that cannot be reached, per word, without writing', async () => {
    const result = await run(['play', '--dir', GAME, '--to', 'ja'], { files: base, answers: () => undefined })
    expect(result.code).toBe(1)
    expect(result.err).toContain('ja "play"')
    expect(result.err).toContain('offline')
  })

  it('the request carries the key, the source, the note and the language’s existing words', async () => {
    const files = {
      ...base,
      [`${UI}/context.json`]: JSON.stringify({ play: { note: 'The big button on the title screen.' } }),
      [`${UI}/ja.json`]: json({ more: 'あと{count}件' }),
      [`${GAME}/words-sources.json`]: JSON.stringify({ ui: { ja: { more: sourceHash('+{count} more') } } }),
    }
    const result = await run(['--dir', GAME, '--to', 'ja'], { files })
    expect(result.requests).toEqual([
      expect.objectContaining({
        lang: 'ja',
        key: 'play',
        source: 'Play',
        note: 'The big button on the title screen.',
        terms: { more: 'あと{count}件' },
      }),
    ])
  })

  it('no key: one sentence, exit 2, no file read or written', async () => {
    const result = await run(['--dir', GAME], { files: base, key: false })
    expect(result.code).toBe(2)
    expect(result.err).toBe(
      'automata words needs ANTHROPIC_API_KEY set on this computer to reach the translator; nothing was changed.\n',
    )
    expect(result.requests).toEqual([])
    expect([...result.files.keys()]).toEqual([`${UI}/en.json`])
  })

  it('--mark records the sources of existing translations and calls no model, with no key', async () => {
    const files = { ...base, [`${UI}/ja.json`]: json({ play: 'プレイ' }) }
    const result = await run(['--dir', GAME, '--mark', '--to', 'ja'], { files, key: false })
    expect(result.code).toBe(0)
    expect(result.requests).toEqual([])
    expect(JSON.parse(result.files.get(`${GAME}/words-sources.json`) ?? '{}')).toEqual({
      ui: { ja: { play: sourceHash('Play') } },
    })
  })

  it('nothing to do prints nothing and exits 0', async () => {
    const files = {
      ...base,
      [`${UI}/ja.json`]: json({ play: 'a', more: 'b' }),
      [`${GAME}/words-sources.json`]: JSON.stringify({
        ui: { ja: { play: sourceHash('Play'), more: sourceHash('+{count} more') } },
      }),
    }
    const result = await run(['--dir', GAME], { files })
    expect(result.code).toBe(0)
    expect(result.out).toBe('')
    expect(result.err).toBe('')
  })

  it('--catalog works one folder with the six default languages and its own record', async () => {
    const files = { '/pkg/words/en.json': json({ a: 'Hi' }) }
    const result = await run(['--dir', GAME, '--catalog', '/pkg/words'], { files })
    expect(new Set(result.requests.map((r) => r.lang))).toEqual(
      new Set(['ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans']),
    )
    expect(result.files.has('/pkg/words/sources.json')).toBe(true)
    expect(result.files.has('/pkg/words/ja.json')).toBe(true)
  })

  it('tells which catalog a missed word costs in', async () => {
    const files = { [`${GAME}/content/generated/messages/en.json`]: json({ a: 'Hi' }) }
    const result = await run(['--dir', GAME, '--to', 'ja'], { files, answers: () => undefined })
    expect(result.out + result.err).toContain('content build')
  })
})
