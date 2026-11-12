import { createServer, type IncomingMessage, type Server } from 'node:http'
import { Effect } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_WORDS_MODEL, WordsModelLive, wordsMessageParams } from '#src/shared/node/words-model-live.ts'
import { WordsModel } from '#src/shared/words/words-model.ts'
import { wordsPrompt } from '#src/shared/words/words-prompt.ts'

// The live translator is tested without the network: it checks the key sentence and builds a request, and never calls
// out. A real call needs a key on someone's computer and is reported as not run.

let stand: Server | undefined
afterEach(async () => {
  vi.unstubAllEnvs()
  await new Promise((resolve) => (stand === undefined ? resolve(undefined) : stand.close(resolve)))
  stand = undefined
})

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

// What the translator's failures mean to a person running `automata words`, shown against a local stand-in for the API
// (the SDK is pointed at it with ANTHROPIC_BASE_URL): no real request, no paid call, no key that is real.

const WORD = {
  type: 'message',
  role: 'assistant',
  model: 'm',
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: { input_tokens: 1, output_tokens: 1 },
  content: [{ type: 'text', text: 'こんにちは' }],
}

/** Starts a stand-in API; `answer` is given each request (counted from 0) and replies with a status and a body. */
async function standIn(
  answer: (index: number, request: IncomingMessage) => { status: number; body?: unknown },
) {
  const seen: IncomingMessage[] = []
  stand = createServer((request, response) => {
    request.resume()
    const { status, body } = answer(seen.length, request)
    seen.push(request)
    // The SDK waits as long as `retry-after-ms` says before it asks again; a millisecond keeps these quick.
    response.writeHead(status, { 'content-type': 'application/json', 'retry-after-ms': '1' })
    response.end(JSON.stringify(body ?? { type: 'error', error: { type: 'api_error', message: 'x' } }))
  })
  await new Promise<void>((resolve) => stand?.listen(0, '127.0.0.1', resolve))
  const address = stand.address()
  if (typeof address !== 'object' || address === null) throw new Error('no address')
  vi.stubEnv('ANTHROPIC_BASE_URL', `http://127.0.0.1:${address.port}`)
  return seen
}

const translate = () =>
  Effect.runPromise(
    Effect.either(
      Effect.flatMap(WordsModel, (model) => model.translate(request)).pipe(Effect.provide(WordsModelLive)),
    ),
  )

const reasonOf = (result: Awaited<ReturnType<typeof translate>>) =>
  result._tag === 'Left' ? result.left.reason : result.right

describe('WordsModelLive against a stand-in for the API', () => {
  it.each([
    [401, 'bad-key'],
    [403, 'bad-key'],
    [429, 'busy'],
    [529, 'busy'],
    [500, 'offline'],
    [503, 'offline'],
    [400, 'refused'],
    [404, 'refused'],
  ] as const)('a %d is %s', async (status, reason) => {
    vi.stubEnv('AUTOMATA_ANTHROPIC_KEY', 'a-key-that-is-never-real')
    await standIn(() => ({ status }))
    expect(reasonOf(await translate())).toBe(reason)
  })

  it('is offline when nothing answers at all', async () => {
    vi.stubEnv('AUTOMATA_ANTHROPIC_KEY', 'a-key-that-is-never-real')
    vi.stubEnv('ANTHROPIC_BASE_URL', 'http://127.0.0.1:1')
    expect(reasonOf(await translate())).toBe('offline')
  })

  it('asks again after a 429, a bounded number of times, and then says it is busy', async () => {
    vi.stubEnv('AUTOMATA_ANTHROPIC_KEY', 'a-key-that-is-never-real')
    const seen = await standIn(() => ({ status: 429 }))
    expect(reasonOf(await translate())).toBe('busy')
    expect(seen.length).toBeGreaterThan(1)
    expect(seen.length).toBeLessThanOrEqual(5)
  })

  it('takes the answer that comes after a 429', async () => {
    vi.stubEnv('AUTOMATA_ANTHROPIC_KEY', 'a-key-that-is-never-real')
    const seen = await standIn((index) => (index === 0 ? { status: 429 } : { status: 200, body: WORD }))
    expect(reasonOf(await translate())).toBe('こんにちは')
    expect(seen).toHaveLength(2)
  })

  it('does not ask again after a wrong key: once is enough', async () => {
    vi.stubEnv('AUTOMATA_ANTHROPIC_KEY', 'a-key-that-is-never-real')
    const seen = await standIn(() => ({ status: 401 }))
    await translate()
    expect(seen).toHaveLength(1)
  })
})

// Where the key comes from: AUTOMATA_ANTHROPIC_KEY first, so a session that must not hold ANTHROPIC_API_KEY (the
// sessions' own runtime would pick it up) can still run the command; then ANTHROPIC_API_KEY. It is sent to the API as
// the SDK sends it and is never in a message.
describe('the key', () => {
  // The SDK sends the key as a bearer token.
  const keyOf = (request: IncomingMessage) => request.headers.authorization?.replace(/^Bearer /, '')

  it('is AUTOMATA_ANTHROPIC_KEY when both are set', async () => {
    vi.stubEnv('AUTOMATA_ANTHROPIC_KEY', 'the-automata-key')
    vi.stubEnv('ANTHROPIC_API_KEY', 'the-other-key')
    const seen = await standIn(() => ({ status: 200, body: WORD }))
    await translate()
    expect(keyOf(seen[0] as IncomingMessage)).toBe('the-automata-key')
  })

  it('is ANTHROPIC_API_KEY when that is the only one', async () => {
    vi.stubEnv('AUTOMATA_ANTHROPIC_KEY', '')
    vi.stubEnv('ANTHROPIC_API_KEY', 'the-other-key')
    const seen = await standIn(() => ({ status: 200, body: WORD }))
    await translate()
    expect(keyOf(seen[0] as IncomingMessage)).toBe('the-other-key')
  })

  it('makes the run available with AUTOMATA_ANTHROPIC_KEY alone, and unavailable with neither', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    vi.stubEnv('AUTOMATA_ANTHROPIC_KEY', 'the-automata-key')
    const check = () =>
      Effect.runPromise(
        Effect.either(
          Effect.flatMap(WordsModel, (model) => model.check()).pipe(Effect.provide(WordsModelLive)),
        ),
      )
    expect((await check())._tag).toBe('Right')
    vi.stubEnv('AUTOMATA_ANTHROPIC_KEY', '')
    expect((await check())._tag).toBe('Left')
  })

  it('is in no message the tool prints', async () => {
    vi.stubEnv('AUTOMATA_ANTHROPIC_KEY', 'the-automata-key-123')
    await standIn(() => ({ status: 401 }))
    const result = await translate()
    expect(JSON.stringify(result)).not.toContain('the-automata-key-123')
  })
})
