import { Data } from 'effect'
import type { YieldableError } from 'effect/Cause'

/*
 * The one failure of `resolveExtensions`.
 *
 * The repo builds with `isolatedDeclarations`, which forbids `class X extends Data.TaggedError(…)`
 * directly, so the base constructor gets an explicit type first (the same pattern as `HostError`).
 */

type TaggedErrorClass<Tag extends string, Fields> = new (
  fields: Fields,
) => YieldableError & { readonly _tag: Tag } & Readonly<Fields>

interface ExtensionErrorFields {
  readonly reason: 'duplicate' | 'missing' | 'cycle' | 'manifest-field'
  /**
   * - duplicate: the repeated name.
   * - missing: who needs it, then what is missing.
   * - cycle: the loop, starting at its smallest name and following `requires`.
   * - manifest-field: the extension, then the field Ruken's manifest does not have.
   */
  readonly names: readonly string[]
}
const ExtensionErrorBase: TaggedErrorClass<'ExtensionError', ExtensionErrorFields> =
  Data.TaggedError('ExtensionError')

/** A bad extension list. Thrown, not returned, so a game's Vite build fails with `message`. */
export class ExtensionError extends ExtensionErrorBase {
  // Effect's tagged errors have an empty message by default; the build output needs the names.
  override get message(): string {
    return `${this.reason}: ${this.names.join(', ')}`
  }
}
