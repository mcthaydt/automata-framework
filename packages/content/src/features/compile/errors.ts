// The three ways a compile can end without content (M1.3 spec §3.2). They are Effect tagged errors so a
// caller handles each by name (`Effect.catchTag`) and the CLI maps them to exit codes.

import { type Cause, Data } from 'effect'
import type { Diagnostic } from '../../shared/diagnostics/diagnostic'

/**
 * The class `Data.TaggedError(tag)` returns, written out. `isolatedDeclarations` cannot infer the type of a
 * call in an `extends` clause, so each error extends a constant annotated with this type instead.
 */
export type TaggedErrorClass<Tag extends string, Fields> = new (
  fields: Fields,
) => Cause.YieldableError & { readonly _tag: Tag } & Readonly<Fields>

const CompileFailedBase: TaggedErrorClass<
  'ContentCompileFailed',
  { readonly diagnostics: readonly Diagnostic[] }
> = Data.TaggedError('ContentCompileFailed')

/** The authored content has problems. Every one is listed, sorted; nothing was written. */
export class ContentCompileFailed extends CompileFailedBase {}

const InvalidConfigBase: TaggedErrorClass<'InvalidContentConfig', { readonly message: string }> =
  Data.TaggedError('InvalidContentConfig')

/** The game's code registered something unusable (a duplicate kind, a clashing generator). */
export class InvalidContentConfig extends InvalidConfigBase {}

const WriteFailedBase: TaggedErrorClass<
  'ContentWriteFailed',
  { readonly path: string; readonly cause: unknown }
> = Data.TaggedError('ContentWriteFailed')

/** An output could not be written. Files already replaced are whole; none is half written. */
export class ContentWriteFailed extends WriteFailedBase {}
