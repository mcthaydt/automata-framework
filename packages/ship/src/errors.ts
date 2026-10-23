import type { TaggedErrorClass } from '@mcthaydt/automata-node'
import type { ManifestError } from '@ruken/manifest'
import { Data } from 'effect'
import type { UndeclaredBoardFound } from './prepare/board-names.ts'
import type { OrientationMismatchFound } from './prepare/orientation.ts'
import type { SecretFound } from './prepare/secret-scan.ts'

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

const SecretInBuildBase: TaggedErrorClass<
  'SecretInBuild',
  {
    readonly found: readonly SecretFound[]
  }
> = Data.TaggedError('SecretInBuild')
/** The build holds a key, an `.env` value or a high-entropy string (QB-b). The message never holds the secret. */
export class SecretInBuild extends SecretInBuildBase {
  override get message(): string {
    const listed = this.found
      .map(
        (found) =>
          `${found.file}:${found.line}:${found.col} (byte ${found.offset}): ${found.rule}: ${found.detail}`,
      )
      .join('\n')
    return `the build holds what looks like a secret, and everything in a build is public. Remove it from the game's code (keep secrets on a server), then build again:\n${listed}`
  }
}

const UndeclaredBoardBase: TaggedErrorClass<
  'UndeclaredBoard',
  {
    readonly found: readonly UndeclaredBoardFound[]
  }
> = Data.TaggedError('UndeclaredBoard')
/** The game names a leaderboard its ship config's `leaderboards` does not declare (M5 spec §4.8, L-b). */
export class UndeclaredBoard extends UndeclaredBoardBase {
  override get message(): string {
    const listed = this.found
      .map((found) => `${found.file}:${found.line}:${found.col}: "${found.board}"`)
      .join('\n')
    return `the game names leaderboards its ship config does not declare, so Ruken has nowhere to put their scores. Declare each in ship.config.ts under leaderboards, or fix the name:\n${listed}`
  }
}

const OrientationMismatchBase: TaggedErrorClass<
  'OrientationMismatch',
  {
    readonly found: readonly OrientationMismatchFound[]
  }
> = Data.TaggedError('OrientationMismatch')
/** The game plays in an orientation its ship config's `runtime.orientation` does not send Ruken (M4.7 follow-up). */
export class OrientationMismatch extends OrientationMismatchBase {
  override get message(): string {
    const listed = this.found
      .map(
        (found) =>
          `${found.file}:${found.line}:${found.col}: defineGame plays "${found.orientation}", but runtime.orientation is "${found.declared}"`,
      )
      .join('\n')
    return `the game plays in an orientation its ship config does not declare, so the rotate hint and the host's frame disagree. Make runtime.orientation in ship.config.ts and the game's orientation the same:\n${listed}`
  }
}

const ManifestInputsMismatchBase: TaggedErrorClass<
  'ManifestInputsMismatch',
  {
    readonly problems: readonly string[]
  }
> = Data.TaggedError('ManifestInputsMismatch')
/** `runtime.inputs` disagrees with the game's input bindings (M4 spec §4.13, I-g). */
export class ManifestInputsMismatch extends ManifestInputsMismatchBase {
  override get message(): string {
    return `ruken.toml's runtime.inputs disagrees with the game's input bindings; fix ship.config.ts or the bindings:\n${this.problems.join('\n')}`
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
/** `test-remote` stopped without a green run; `reason` says why and `message` says what to do. */
export class TestRemoteFailed extends TestRemoteFailedBase {}
