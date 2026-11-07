import { Context, Data, Effect, Layer } from 'effect'
import type { TaggedErrorClass } from '../../shared/node/errors.ts'
import { ProcessRunner, type RunResult } from '../../shared/node/process-runner.ts'

// Where `automata add` gets kits: the Automata Plus git repository, read with the buyer's own git credentials
//. A port, so `runAdd`'s tests use a fake repository and only the live
// implementation runs git.

const KitSourceErrorBase: TaggedErrorClass<
  'KitSourceError',
  { readonly repo: string; readonly detail: string }
> = Data.TaggedError('KitSourceError')

/** The repository could not be read: no access, not found, no network, or no git. `detail` is git's own words. */
export class KitSourceError extends KitSourceErrorBase {
  override get message(): string {
    return `${this.repo}: ${this.detail}`
  }
}

export interface KitSourceService {
  /** The repository's tag names, without `refs/tags/`. */
  tags(repo: string): Effect.Effect<readonly string[], KitSourceError>
  /** Writes the repository's files at `tag` into `into`, a folder that does not exist yet. */
  clone(repo: string, tag: string, into: string): Effect.Effect<void, KitSourceError>
}

/** The service's tag; see `Files` in `@mcthaydt/automata-node` for why it is not a `Context.Tag` class. */
export interface KitSource {
  readonly _KitSource: unique symbol
}
export const KitSource: Context.Tag<KitSource, KitSourceService> = Context.GenericTag<
  KitSource,
  KitSourceService
>('@mcthaydt/automata-cli/KitSource')

/**
 * git with the buyer's own credentials (their credential helper or SSH agent). `GIT_TERMINAL_PROMPT=0` makes a
 * missing login fail at once with git's message instead of waiting for a password nobody will type. `--` ends
 * the options, so a repository URL is never read as one.
 */
const NO_PROMPT = { env: { GIT_TERMINAL_PROMPT: '0' } }

const TAG_REF = /^[0-9a-f]+\trefs\/tags\/(.+)$/

/** git's stderr without the trailing blank lines, as the buyer would see it. */
const gitWords = (result: RunResult): string =>
  result.stderr.trim() || `git exited with code ${result.exitCode}`

/** `KitSource` over the `git` program: `ls-remote` for the tags, a shallow single-tag `clone` for the files. */
export const KitSourceLive: Layer.Layer<KitSource, never, ProcessRunner> = Layer.effect(
  KitSource,
  Effect.map(ProcessRunner, (runner) => {
    const git = (repo: string, args: readonly string[]): Effect.Effect<string, KitSourceError> =>
      runner.run('git', args, NO_PROMPT).pipe(
        Effect.mapError(
          (error) =>
            new KitSourceError({ repo, detail: `${error.message} (automata add needs git installed)` }),
        ),
        Effect.flatMap((result) =>
          result.exitCode === 0
            ? Effect.succeed(result.stdout)
            : Effect.fail(new KitSourceError({ repo, detail: gitWords(result) })),
        ),
      )
    return {
      tags: (repo) =>
        Effect.map(git(repo, ['ls-remote', '--tags', '--refs', '--', repo]), (stdout) =>
          stdout.split('\n').flatMap((line) => {
            const tag = TAG_REF.exec(line)?.[1]
            return tag === undefined ? [] : [tag]
          }),
        ),
      clone: (repo, tag, into) =>
        Effect.asVoid(
          git(repo, [
            '-c',
            'advice.detachedHead=false',
            'clone',
            '--quiet',
            '--depth=1',
            '--single-branch',
            `--branch=${tag}`,
            '--',
            repo,
            into,
          ]),
        ),
    }
  }),
)
