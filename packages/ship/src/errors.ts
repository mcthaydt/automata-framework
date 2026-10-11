import type { ManifestError } from '@ruken/manifest'
import { Data } from 'effect'

// Every way a ship step can fail, as tagged errors (ADR 0003). The CLI prints `message`, one line per problem.

/** Ruken's parser refused the generated `ruken.toml`. `problems` are Ruken's own issues, unchanged. */
export class ManifestInvalid extends Data.TaggedError('ManifestInvalid')<{
  readonly problems: readonly ManifestError[]
}> {
  override get message(): string {
    return this.problems
      .map((problem) => `ruken.toml ${problem.path || '(file)'}: ${problem.message}`)
      .join('\n')
  }
}

/** A release tag that is not `v<version>`. */
export class VersionMismatch extends Data.TaggedError('VersionMismatch')<{
  readonly version: string
  readonly tag: string
  readonly message: string
}> {}

/** The build names its own files from the origin's root, which 404s under `/b/<buildId>/`. */
export class RootAbsoluteReference extends Data.TaggedError('RootAbsoluteReference')<{
  readonly references: readonly { readonly file: string; readonly reference: string }[]
}> {
  override get message(): string {
    const listed = this.references.map((found) => `${found.file}: ${found.reference}`).join('\n')
    return `the build names its own files by root-absolute paths, which 404 inside Ruken (/b/<buildId>/):\n${listed}`
  }
}

/** `[game] entry` names a file the build does not have. */
export class EntryMissing extends Data.TaggedError('EntryMissing')<{
  readonly entry: string
  readonly distDir: string
}> {
  override get message(): string {
    return `the entry page ${this.entry} is not in ${this.distDir}`
  }
}

/** Reading or writing a file failed. */
export class FileError extends Data.TaggedError('FileError')<{
  readonly path: string
  readonly cause: unknown
}> {
  override get message(): string {
    return `${this.path}: ${this.cause instanceof Error ? this.cause.message : String(this.cause)}`
  }
}
