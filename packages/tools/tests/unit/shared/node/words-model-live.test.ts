import { Effect } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_WORDS_MODEL, WordsModelLive, wordsMessageParams } from '#src/shared/node/words-model-live.ts'
import { WordsModel } from '#src/shared/words/words-model.ts'
import { wordsPrompt } from '#src/shared/words/words-prompt.ts'

// The live translator is tested without the network: it checks the key sentence and builds a request, and never calls
// out. A real call needs a key on someone's computer and is reported as not run.

afterEach(() => vi.unstubAllEnvs())

const request = { lang: 'ja', key: 'play', source: 'Play', note: undefined, terms: {} }

describe('WordsModelLive', () => {
  it('is unavailable with no key, before anything is sent', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const result = await Effect.runPromise(
      Effect.either(
        Effect.flatMap(WordsModel, (model) => model.check()).pipe(Effect.provide(WordsModelLive)),
      ),
    )
    expect(result._tag).toBe('Left')
    expect(result._tag === 'Left' ? result.left.reason : '').toBe('no-key')
  })

  it('is available with a key set', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'a-key-that-is-never-used')
    await Effect.runPromise(
      Effect.flatMap(WordsModel, (model) => model.check()).pipe(Effect.provide(WordsModelLive)),
    )
  })
})

describe('wordsMessageParams', () => {
  it("asks the default model with the prompt as the user's message", () => {
    const params = wordsMessageParams(request)
    expect(params.model).toBe(DEFAULT_WORDS_MODEL)
    expect(params.fallbacks).toBe('default')
    expect(params.messages).toEqual([{ role: 'user', content: wordsPrompt(request) }])
  })

  it('asks the model ship.config.ts names, when it names one', () => {
    expect(wordsMessageParams({ ...request, model: 'claude-sonnet-5-5' }).model).toBe('claude-sonnet-5-5')
  })

  it('leaves room for thinking in max_tokens', () => {
    expect(wordsMessageParams(request).max_tokens).toBeGreaterThanOrEqual(16000)
  })
})
