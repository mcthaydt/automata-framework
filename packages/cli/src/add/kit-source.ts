import type { TaggedErrorClass } from '@mcthaydt/automata-node'
import { Context, Data, type Effect } from 'effect'

// Where `automata add` gets kits: the Automata Plus git repository, read with the buyer's own git credentials
// (PRODUCT spec §6 and §9). A port, so `runAdd`'s tests use a fake repository and only the live
// implementation runs git.

const KitSourceErrorBase: TaggedErrorClass<
  'KitSourceError',
  { readonly repo: string; readonly detail: string }
> = Data.TaggedError('KitSourceError')

/** The repository could not be read: no access, not found, no network, or no git. `detail` is git's own words. */
export class KitSourceError extends KitSourceErrorBase {
  override get message(): string {
    return `${this.repo}: ${this.detail}`
  }
}

export interface KitSourceService {
  /** The repository's tag names, without `refs/tags/`. */
  tags(repo: string): Effect.Effect<readonly string[], KitSourceError>
  /** Writes the repository's files at `tag` into `into`, a folder that does not exist yet. */
  clone(repo: string, tag: string, into: string): Effect.Effect<void, KitSourceError>
}

/** The service's tag; see `Files` in `@mcthaydt/automata-node` for why it is not a `Context.Tag` class. */
export interface KitSource {
  readonly _KitSource: unique symbol
}
export const KitSource: Context.Tag<KitSource, KitSourceService> = Context.GenericTag<
  KitSource,
  KitSourceService
>('@mcthaydt/automata-cli/KitSource')
