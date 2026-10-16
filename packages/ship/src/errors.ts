import type { TaggedErrorClass } from '@mcthaydt/automata-node'
import type { ManifestError } from '@ruken/manifest'
import { Data } from 'effect'

export { FileError, ProcessError } from '@mcthaydt/automata-node'

// Every way a ship step can fail, as tagged errors (ADR 0003). The CLI prints `message`, one line per problem.
// Each extends a constant typed with `TaggedErrorClass` so the package builds with isolatedDeclarations.

const ManifestInvalidBase: TaggedErrorClass<
  'ManifestInvalid',
  {
    readonly problems: readonly ManifestError[]
  }
> = Data.TaggedError('ManifestInvalid')
/** Ruken's parser refused the generated `ruken.toml`. `problems` are Ruken's own issues, unchanged. */
export class ManifestInvalid extends ManifestInvalidBase {
  override get message(): string {
    return this.problems
      .map((problem) => `ruken.toml ${problem.path || '(file)'}: ${problem.message}`)
      .join('\n')
  }
}

const VersionMismatchBase: TaggedErrorClass<
  'VersionMismatch',
  {
    readonly version: string
    readonly tag: string
    readonly message: string
  }
> = Data.TaggedError('VersionMismatch')
/** A release tag that is not `v<version>`. */
export class VersionMismatch extends VersionMismatchBase {}

const RootAbsoluteReferenceBase: TaggedErrorClass<
  'RootAbsoluteReference',
  {
    readonly references: readonly { readonly file: string; readonly reference: string }[]
  }
> = Data.TaggedError('RootAbsoluteReference')
/** The build names its own files from the origin's root, which 404s under `/b/<buildId>/`. */
export class RootAbsoluteReference extends RootAbsoluteReferenceBase {
  override get message(): string {
    const listed = this.references.map((found) => `${found.file}: ${found.reference}`).join('\n')
    return `the build names its own files by root-absolute paths, which 404 inside Ruken (/b/<buildId>/), or has a script that could not be checked:\n${listed}`
  }
}

const EntryMissingBase: TaggedErrorClass<
  'EntryMissing',
  {
    readonly entry: string
    readonly distDir: string
  }
> = Data.TaggedError('EntryMissing')
/** `[game] entry` names a file the build does not have. */
export class EntryMissing extends EntryMissingBase {
  override get message(): string {
    return `the entry page ${this.entry} is not in ${this.distDir}`
  }
}

const PublishRejectedBase: TaggedErrorClass<'PublishRejected', PublishFailure> =
  Data.TaggedError('PublishRejected')
/** What `ruken publish` printed on stderr, kept so the CLI can show Ruken's own words. */
interface PublishFailure {
  readonly exitCode: number
  readonly output: string
}

const publishMessage = (what: string, failure: PublishFailure): string =>
  `ruken publish ${what} (exit ${failure.exitCode})${failure.output === '' ? '' : `:\n${failure.output.trim()}`}`

/** Exit 1: Ruken's checks rejected the build. */
export class PublishRejected extends PublishRejectedBase {
  override get message(): string {
    return publishMessage('rejected the build', this)
  }
}

const PublishUsageBase: TaggedErrorClass<'PublishUsage', PublishFailure> = Data.TaggedError('PublishUsage')
/** Exit 2: the command line was wrong. */
export class PublishUsage extends PublishUsageBase {
  override get message(): string {
    return publishMessage('did not understand the command', this)
  }
}

const PublishAuthBase: TaggedErrorClass<'PublishAuth', PublishFailure> = Data.TaggedError('PublishAuth')
/** Exit 3: the token was missing, wrong or lacks the rights. */
export class PublishAuth extends PublishAuthBase {
  override get message(): string {
    return publishMessage('was refused the token', this)
  }
}

const PublishTimeoutBase: TaggedErrorClass<'PublishTimeout', PublishFailure> =
  Data.TaggedError('PublishTimeout')
/** Exit 4: Ruken's checks took longer than the CLI waits. */
export class PublishTimeout extends PublishTimeoutBase {
  override get message(): string {
    return publishMessage('gave up waiting for Ruken', this)
  }
}

const PublishFailedBase: TaggedErrorClass<'PublishFailed', PublishFailure> = Data.TaggedError('PublishFailed')
/** Any other exit code. */
export class PublishFailed extends PublishFailedBase {
  override get message(): string {
    return publishMessage('failed', this)
  }
}

const DeployFailedBase: TaggedErrorClass<
  'DeployFailed',
  {
    readonly step: 'tar' | 'ssh'
    readonly exitCode: number
    readonly output: string
  }
> = Data.TaggedError('DeployFailed')
/** The dev host's deploy step (tar or ssh) failed; `output` is what it printed. */
export class DeployFailed extends DeployFailedBase {
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

const TestRemoteFailedBase: TaggedErrorClass<
  'TestRemoteFailed',
  {
    readonly reason: TestRemoteReason
    readonly message: string
  }
> = Data.TaggedError('TestRemoteFailed')
export class TestRemoteFailed extends TestRemoteFailedBase {}

/** The `prepare --target itch` check that failed, in the order they run (PUB spec §4). */
export type ItchCheck = 'entry' | 'file-count' | 'path-length' | 'file-size' | 'case' | 'ruken-toml'

const ItchBuildInvalidBase: TaggedErrorClass<
  'ItchBuildInvalid',
  {
    readonly check: ItchCheck
    readonly problems: readonly string[]
  }
> = Data.TaggedError('ItchBuildInvalid')
/** The build breaks one of itch.io's rules; each problem names the file and the limit. */
export class ItchBuildInvalid extends ItchBuildInvalidBase {
  override get message(): string {
    return `the build is not ready for itch.io (${this.check}):\n${this.problems.join('\n')}`
  }
}

const ItchSettingMissingBase: TaggedErrorClass<
  'ItchSettingMissing',
  {
    readonly setting: 'itch' | 'BUTLER_API_KEY' | 'butler'
    readonly message: string
  }
> = Data.TaggedError('ItchSettingMissing')
/** `publish --target itch` lacks the config section, the key or butler; found before anything runs. */
export class ItchSettingMissing extends ItchSettingMissingBase {}

const ButlerFailedBase: TaggedErrorClass<'ButlerFailed', { readonly exitCode: number }> =
  Data.TaggedError('ButlerFailed')
/** butler exited non-zero. Its output was already shown as it ran; the CLI exits with butler's own code. */
export class ButlerFailed extends ButlerFailedBase {
  override get message(): string {
    return `butler push failed (exit ${this.exitCode}); butler's output is above`
  }
}
