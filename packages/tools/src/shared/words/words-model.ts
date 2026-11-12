import { Context, Data, type Effect } from 'effect'
import type { TaggedErrorClass } from '../node/errors.ts'
import type { Catalog } from './catalog.ts'

// The port `automata words` translates through. The live adapter (`shared/node/words-model-live.ts`) is the one file
// that reaches the network; everything else sees only this.

/** One word to translate. */
export interface TranslationRequest {
  /** The language to translate into: `ja`. */
  readonly lang: string
  readonly key: string
  /** The source text, placeholders and all. */
  readonly source: string
  /** The catalog's `context.json` note for the key: where the word shows and what pressing it does. */
  readonly note: string | undefined
  /** The words already chosen for this language, so a term stays the same everywhere. */
  readonly terms: Catalog
  /** The model `ship.config.ts` asks for (`words.model`); the live adapter's own default when absent. */
  readonly model?: string | undefined
}

/** Why the translator cannot answer, by what the person should do about it. */
export type WordsUnavailableReason =
  /** No key on this computer. */
  | 'no-key'
  /** The key was sent and not accepted (401, 403): wrong, expired or revoked. Asking again fails the same way. */
  | 'bad-key'
  /** Too many requests, or the service overloaded (429, 529), still so after the retries. Wait, then run it again. */
  | 'busy'
  /** Nothing could be reached, or the service is down (a network error, a 5xx). */
  | 'offline'
  /** The model declined the request, or the service answered a request it will not take. Another word may go through. */
  | 'refused'

const UnavailableBase: TaggedErrorClass<
  'WordsModelUnavailable',
  { readonly reason: WordsUnavailableReason }
> = Data.TaggedError('WordsModelUnavailable')

/** What each reason says to the person running the command, in one sentence. */
const UNAVAILABLE_MESSAGES: Readonly<Record<WordsUnavailableReason, string>> = {
  'no-key': 'no key is set (AUTOMATA_ANTHROPIC_KEY or ANTHROPIC_API_KEY)',
  'bad-key':
    'the translator did not accept the key (AUTOMATA_ANTHROPIC_KEY or ANTHROPIC_API_KEY): check it is the right one and still active',
  busy: 'the translator is busy, or this key is over its limit, right now',
  offline: 'the translator could not be reached, or is down (offline?)',
  refused: 'the translator refused the request',
}

/** The translator cannot answer: no key, a key it does not accept, a limit, an outage, or a refusal of this request. */
export class WordsModelUnavailable extends UnavailableBase {
  override get message(): string {
    return UNAVAILABLE_MESSAGES[this.reason]
  }
}

/**
 * Whether asking for another word would fail the same way: a bad key, a limit and an outage are about the translator,
 * not the word, so a run stops at the first. A refusal is about one word, and the run goes on.
 */
export const stopsTheRun = (reason: WordsUnavailableReason): boolean =>
  reason === 'bad-key' || reason === 'busy' || reason === 'offline'

/** What the port does. */
export interface WordsModelService {
  /** Whether a translator can be reached at all, before any file is read. Fails `no-key` with no key on this computer. */
  check(): Effect.Effect<void, WordsModelUnavailable>
  /** One word's translation, as the model wrote it (not yet checked). */
  translate(request: TranslationRequest): Effect.Effect<string, WordsModelUnavailable>
}

/** The tag, as `Files` is: an identity interface and a generic tag, for isolatedDeclarations. */
export interface WordsModel {
  readonly _WordsModel: unique symbol
}
export const WordsModel: Context.Tag<WordsModel, WordsModelService> = Context.GenericTag<
  WordsModel,
  WordsModelService
>('@automataframework/tools/WordsModel')
