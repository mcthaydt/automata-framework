import { Data } from 'effect'

/** Reading, writing, listing or removing a file failed. */
export class FileError extends Data.TaggedError('FileError')<{
  readonly path: string
  readonly cause: unknown
}> {
  override get message(): string {
    return `${this.path}: ${this.cause instanceof Error ? this.cause.message : String(this.cause)}`
  }
}

/** A program could not be started (not found, not executable). A non-zero exit is not this error. */
export class ProcessError extends Data.TaggedError('ProcessError')<{
  readonly command: string
  readonly cause: unknown
}> {
  override get message(): string {
    return `could not run ${this.command}: ${this.cause instanceof Error ? this.cause.message : String(this.cause)}`
  }
}
