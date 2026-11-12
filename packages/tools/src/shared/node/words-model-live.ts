import Anthropic from '@anthropic-ai/sdk'
import { Effect, Layer } from 'effect'
import {
  type TranslationRequest,
  WordsModel,
  WordsModelUnavailable,
  type WordsUnavailableReason,
} from '../words/words-model.ts'
import { WORDS_SYSTEM, wordsPrompt } from '../words/words-prompt.ts'

// The one file of the words feature that reaches the network. It reads the key from the process's environment and from
// nowhere else, never writes or logs it, and hands it to nothing but the SDK that sends the request. The key is
// `AUTOMATA_ANTHROPIC_KEY` when that is set, else `ANTHROPIC_API_KEY`: a session whose own runtime would pick up
// `ANTHROPIC_API_KEY` sets the first, which this tool alone reads.

/** The model asked when `ship.config.ts` names none. */
export const DEFAULT_WORDS_MODEL = 'claude-opus-5-5'

/**
 * The request for one word. Thinking is always on for this model and counts against `max_tokens`, so the ceiling is
 * generous; a low effort keeps a one-line translation quick.
 */
export function wordsMessageParams(
  request: TranslationRequest,
): Anthropic.Beta.MessageCreateParamsNonStreaming {
  return {
    // A refused translation is run again on the fallback model by the server, so a policy false positive on a
    // harmless menu word does not stop the run.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    model: request.model ?? DEFAULT_WORDS_MODEL,
    max_tokens: 16000,
    output_config: { effort: 'low' },
    system: WORDS_SYSTEM,
    messages: [{ role: 'user', content: wordsPrompt(request) }],
  }
}

/** The key `automata words` sends: `AUTOMATA_ANTHROPIC_KEY`, then `ANTHROPIC_API_KEY`; undefined with neither. */
const keyFromEnvironment = (): string | undefined => {
  for (const name of ['AUTOMATA_ANTHROPIC_KEY', 'ANTHROPIC_API_KEY']) {
    const value = process.env[name]
    if (value !== undefined && value !== '') return value
  }
  return undefined
}

/**
 * How many times the SDK asks again after a 429 (and a 5xx or a dropped connection), waiting longer each time and as long
 * as the service's `retry-after` says. Bounded, so a key that stays over its limit ends the run instead of waiting for ever.
 */
const RETRIES = 3

/** What an SDK failure means to the report: a wrong key, a limit, no way to connect, an outage, or a refusal. */
function unavailable(error: unknown): WordsModelUnavailable {
  if (error instanceof WordsModelUnavailable) return error
  const reason = (): WordsUnavailableReason => {
    if (!(error instanceof Anthropic.APIError) || error instanceof Anthropic.APIConnectionError)
      return 'offline'
    const status = error.status ?? 0
    if (status === 401 || status === 403) return 'bad-key'
    if (status === 429 || status === 529) return 'busy'
    if (status >= 500) return 'offline'
    return 'refused'
  }
  return new WordsModelUnavailable({ reason: reason() })
}

/** The translator on Anthropic's API through the official SDK. */
export const WordsModelLive: Layer.Layer<WordsModel> = Layer.succeed(WordsModel, {
  check: () =>
    keyFromEnvironment() !== undefined
      ? Effect.void
      : Effect.fail(new WordsModelUnavailable({ reason: 'no-key' })),
  translate: (request) =>
    Effect.tryPromise({
      try: async () => {
        const client = new Anthropic({ apiKey: keyFromEnvironment() ?? null, maxRetries: RETRIES })
        const response = await client.beta.messages.create(wordsMessageParams(request))
        if (response.stop_reason === 'refusal') throw new WordsModelUnavailable({ reason: 'refused' })
        const text = response.content.find((block) => block.type === 'text')
        return text?.type === 'text' ? text.text : ''
      },
      catch: unavailable,
    }),
})
