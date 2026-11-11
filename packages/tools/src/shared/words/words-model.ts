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

const UnavailableBase: TaggedErrorClass<
  'WordsModelUnavailable',
  { readonly reason: 'no-key' | 'refused' | 'offline' }
> = Data.TaggedError('WordsModelUnavailable')

/** The translator cannot answer: there is no key on this computer, it refused the request, or it cannot be reached. */
export class WordsModelUnavailable extends UnavailableBase {
  override get message(): string {
    return this.reason === 'no-key'
      ? 'no ANTHROPIC_API_KEY is set'
      : this.reason === 'offline'
        ? 'the translator could not be reached (offline?)'
        : 'the translator refused the request'
  }
}

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
>('@automata/tools/WordsModel')
