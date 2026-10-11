import type { ManifestError } from '@ruken/manifest'
import { Data } from 'effect'

export { FileError, ProcessError } from '@mcthaydt/automata-node'

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

/** What `ruken publish` printed on stderr, kept so the CLI can show Ruken's own words. */
interface PublishFailure {
  readonly exitCode: number
  readonly output: string
}

const publishMessage = (what: string, failure: PublishFailure): string =>
  `ruken publish ${what} (exit ${failure.exitCode})${failure.output === '' ? '' : `:\n${failure.output.trim()}`}`

/** Exit 1: Ruken's checks rejected the build. */
export class PublishRejected extends Data.TaggedError('PublishRejected')<PublishFailure> {
  override get message(): string {
    return publishMessage('rejected the build', this)
  }
}

/** Exit 2: the command line was wrong. */
export class PublishUsage extends Data.TaggedError('PublishUsage')<PublishFailure> {
  override get message(): string {
    return publishMessage('did not understand the command', this)
  }
}

/** Exit 3: the token was missing, wrong or lacks the rights. */
export class PublishAuth extends Data.TaggedError('PublishAuth')<PublishFailure> {
  override get message(): string {
    return publishMessage('was refused the token', this)
  }
}

/** Exit 4: Ruken's checks took longer than the CLI waits. */
export class PublishTimeout extends Data.TaggedError('PublishTimeout')<PublishFailure> {
  override get message(): string {
    return publishMessage('gave up waiting for Ruken', this)
  }
}

/** Any other exit code. */
export class PublishFailed extends Data.TaggedError('PublishFailed')<PublishFailure> {
  override get message(): string {
    return publishMessage('failed', this)
  }
}

/** The dev host's deploy step (tar or ssh) failed; `output` is what it printed. */
export class DeployFailed extends Data.TaggedError('DeployFailed')<{
  readonly step: 'tar' | 'ssh'
  readonly exitCode: number
  readonly output: string
}> {
  override get message(): string {
    return `deploy-dev: ${this.step} failed (exit ${this.exitCode})${this.output === '' ? '' : `:\n${this.output.trim()}`}`
  }
}

/** Why `test-remote` stopped without a green run. */
export type TestRemoteReason =
  | 'usage'
  | 'detached'
  | 'uncommitted'
  | 'push'
  | 'dispatch'
  | 'no-run'
  | 'no-runner'
  | 'timeout'
  | 'gh-unavailable'
  | 'red'

export class TestRemoteFailed extends Data.TaggedError('TestRemoteFailed')<{
  readonly reason: TestRemoteReason
  readonly message: string
}> {}
