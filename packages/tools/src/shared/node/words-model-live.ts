import Anthropic from '@anthropic-ai/sdk'
import { Effect, Layer } from 'effect'
import { type TranslationRequest, WordsModel, WordsModelUnavailable } from '../words/words-model.ts'
import { WORDS_SYSTEM, wordsPrompt } from '../words/words-prompt.ts'

// The one file of the words feature that reaches the network. It reads the key from the process's environment and from
// nowhere else, never writes or logs it, and hands it to nothing but the SDK that sends the request.

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

const hasKey = (): boolean => (process.env.ANTHROPIC_API_KEY ?? '') !== ''

/** What an SDK failure means to the report: no way to connect, or the service said no. */
function unavailable(error: unknown): WordsModelUnavailable {
  if (error instanceof WordsModelUnavailable) return error
  return new WordsModelUnavailable({
    reason:
      error instanceof Anthropic.APIConnectionError || !(error instanceof Anthropic.APIError)
        ? 'offline'
        : 'refused',
  })
}

let client: Anthropic | undefined

/** The translator on Anthropic's API through the official SDK. */
export const WordsModelLive: Layer.Layer<WordsModel> = Layer.succeed(WordsModel, {
  check: () => (hasKey() ? Effect.void : Effect.fail(new WordsModelUnavailable({ reason: 'no-key' }))),
  translate: (request) =>
    Effect.tryPromise({
      try: async () => {
        client ??= new Anthropic()
        const response = await client.beta.messages.create(wordsMessageParams(request))
        if (response.stop_reason === 'refusal') throw new WordsModelUnavailable({ reason: 'refused' })
        const text = response.content.find((block) => block.type === 'text')
        return text?.type === 'text' ? text.text : ''
      },
      catch: unavailable,
    }),
})
