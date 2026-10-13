import { type Cause, Data } from 'effect'

/**
 * The class `Data.TaggedError(tag)` returns, written out. isolatedDeclarations cannot infer the type of a call in
 * an `extends` clause, so each error extends a constant annotated with this type instead (the pattern of
 * `content`'s compile errors and `host`'s errors). `ship` uses it for its own errors.
 */
export type TaggedErrorClass<Tag extends string, Fields> = new (
  fields: Fields,
) => Cause.YieldableError & { readonly _tag: Tag } & Readonly<Fields>

const describe = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))

const FileErrorBase: TaggedErrorClass<'FileError', { readonly path: string; readonly cause: unknown }> =
  Data.TaggedError('FileError')

/** Reading, writing, listing or removing a file failed. */
export class FileError extends FileErrorBase {
  override get message(): string {
    return `${this.path}: ${describe(this.cause)}`
  }
}

const ProcessErrorBase: TaggedErrorClass<
  'ProcessError',
  { readonly command: string; readonly cause: unknown }
> = Data.TaggedError('ProcessError')

/** A program could not be started (not found, not executable). A non-zero exit is not this error. */
export class ProcessError extends ProcessErrorBase {
  override get message(): string {
    return `could not run ${this.command}: ${describe(this.cause)}`
  }
}
