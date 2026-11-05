import { ProcessError, ProcessRunner, type RunOptions, type RunResult } from '@mcthaydt/automata-node'
import { Effect, Either, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { KitSource, type KitSourceError, KitSourceLive } from './kit-source.ts'

const REPO = 'https://github.com/mcthaydt/automata-plus.git'

interface Call {
  readonly command: string
  readonly args: readonly string[]
  readonly options: RunOptions | undefined
}

function withGit(answer: (args: readonly string[]) => RunResult | ProcessError) {
  const calls: Call[] = []
  const runner = Layer.succeed(ProcessRunner, {
    run: (command, args, options) =>
      Effect.suspend(() => {
        calls.push({ command, args, options })
        const result = answer(args)
        return result instanceof ProcessError ? Effect.fail(result) : Effect.succeed(result)
      }),
  })
  const run = <A, E>(use: (source: typeof KitSource.Service) => Effect.Effect<A, E>) =>
    Effect.runPromise(
      Effect.either(Effect.provide(Effect.flatMap(KitSource, use), Layer.provide(KitSourceLive, runner))),
    )
  return { calls, run }
}

const NO_PROMPT = { env: { GIT_TERMINAL_PROMPT: '0' } }

describe('KitSourceLive', () => {
  it('lists tags with git ls-remote, never asking for a password', async () => {
    const git = withGit(() => ({
      exitCode: 0,
      stdout: 'aaa\trefs/tags/core-v0.0.1\nbbb\trefs/tags/core-v0.0.2\nccc\trefs/tags/notes\n',
      stderr: '',
    }))
    const tags = await git.run((source) => source.tags(REPO))
    expect(tags).toEqual(Either.right(['core-v0.0.1', 'core-v0.0.2', 'notes']))
    expect(git.calls).toEqual([
      { command: 'git', args: ['ls-remote', '--tags', '--refs', '--', REPO], options: NO_PROMPT },
    ])
  })

  it('clones only the tag, one commit deep', async () => {
    const git = withGit(() => ({ exitCode: 0, stdout: '', stderr: '' }))
    const cloned = await git.run((source) => source.clone(REPO, 'core-v0.0.2', '/tmp/x/repository'))
    expect(Either.isRight(cloned)).toBe(true)
    expect(git.calls).toEqual([
      {
        command: 'git',
        args: [
          '-c',
          'advice.detachedHead=false',
          'clone',
          '--quiet',
          '--depth=1',
          '--single-branch',
          '--branch=core-v0.0.2',
          '--',
          REPO,
          '/tmp/x/repository',
        ],
        options: NO_PROMPT,
      },
    ])
  })

  it("fails with git's own words when git exits non-zero", async () => {
    const git = withGit(() => ({
      exitCode: 128,
      stdout: '',
      stderr: "remote: Repository not found.\nfatal: repository 'https://github.com/x/y.git/' not found\n\n",
    }))
    const errorOf = (result: Either.Either<unknown, KitSourceError>): KitSourceError => {
      if (Either.isRight(result)) throw new Error('expected a failure')
      return result.left
    }
    for (const error of [
      errorOf(await git.run((source) => source.tags(REPO))),
      errorOf(await git.run((source) => source.clone(REPO, 'core-v0.0.2', '/tmp/x'))),
    ]) {
      expect(error._tag).toBe('KitSourceError')
      expect(error.repo).toBe(REPO)
      expect(error.detail).toBe(
        "remote: Repository not found.\nfatal: repository 'https://github.com/x/y.git/' not found",
      )
    }
  })

  it('says git is missing when it cannot be started', async () => {
    const git = withGit(() => new ProcessError({ command: 'git', cause: 'spawn git ENOENT' }))
    const result = await git.run((source) => source.tags(REPO))
    if (Either.isRight(result)) throw new Error('expected a failure')
    expect(result.left.detail).toBe('could not run git: spawn git ENOENT (automata add needs git installed)')
  })
})
