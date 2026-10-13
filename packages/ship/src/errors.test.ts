import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  DeployFailed,
  EntryMissing,
  ManifestInvalid,
  PublishAuth,
  PublishFailed,
  PublishRejected,
  PublishTimeout,
  PublishUsage,
  RootAbsoluteReference,
  TestRemoteFailed,
  VersionMismatch,
} from './errors.ts'

// The errors are typed through `TaggedErrorClass` so ship builds with isolatedDeclarations (M2.4 spec §2).
// Each keeps its tag, its fields and its message, and `Effect.catchTag` still finds it.
const catchesByTag = (error: { readonly _tag: string }): string =>
  Effect.runSync(Effect.catchAll(Effect.fail(error), (failure) => Effect.succeed(failure._tag)))

const failure = { exitCode: 1, output: 'no\n' }
const cases = [
  [
    new ManifestInvalid({ problems: [{ path: 'game.id', message: 'bad' }] as never }),
    'ManifestInvalid',
    'ruken.toml game.id: bad',
  ],
  [
    new VersionMismatch({ version: '1.0.0', tag: 'v2', message: 'tag v2 is not v1.0.0' }),
    'VersionMismatch',
    'tag v2 is not v1.0.0',
  ],
  [
    new RootAbsoluteReference({ references: [{ file: 'index.html', reference: '/a.js' }] }),
    'RootAbsoluteReference',
    'index.html: /a.js',
  ],
  [
    new EntryMissing({ entry: 'index.html', distDir: 'dist' }),
    'EntryMissing',
    'the entry page index.html is not in dist',
  ],
  [new PublishRejected(failure), 'PublishRejected', 'ruken publish rejected the build (exit 1):\nno'],
  [new PublishUsage(failure), 'PublishUsage', 'ruken publish did not understand the command (exit 1):\nno'],
  [new PublishAuth(failure), 'PublishAuth', 'ruken publish was refused the token (exit 1):\nno'],
  [new PublishTimeout(failure), 'PublishTimeout', 'ruken publish gave up waiting for Ruken (exit 1):\nno'],
  [new PublishFailed(failure), 'PublishFailed', 'ruken publish failed (exit 1):\nno'],
  [
    new DeployFailed({ step: 'ssh', exitCode: 255, output: '' }),
    'DeployFailed',
    'deploy-dev: ssh failed (exit 255)',
  ],
  [new TestRemoteFailed({ reason: 'red', message: 'the run failed' }), 'TestRemoteFailed', 'the run failed'],
] as const

describe('ship errors', () => {
  it.each(cases)('%s keeps its tag and message and is an Error', (error, tag, message) => {
    expect(error._tag).toBe(tag)
    expect(error.message).toContain(message)
    expect(error).toBeInstanceOf(Error)
    expect(catchesByTag(error)).toBe(tag)
  })

  it('keeps the fields callers read', () => {
    expect(new PublishAuth(failure).exitCode).toBe(1)
    expect(new DeployFailed({ step: 'tar', exitCode: 2, output: 'x' }).step).toBe('tar')
    expect(new TestRemoteFailed({ reason: 'timeout', message: 'm' }).reason).toBe('timeout')
    expect(new EntryMissing({ entry: 'a.html', distDir: 'd' })).toBeInstanceOf(EntryMissing)
  })

  it('is caught by Effect.catchTag', () => {
    const caught = Effect.runSync(
      Effect.catchTag(
        Effect.fail(new PublishRejected(failure)) as Effect.Effect<never, PublishRejected | PublishAuth>,
        'PublishRejected',
        (error) => Effect.succeed(error.exitCode),
      ).pipe(Effect.catchAll(() => Effect.succeed(-1))),
    )
    expect(caught).toBe(1)
  })
})
