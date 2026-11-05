import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Effect } from 'effect'
import type { ProcessError } from '../../../node/errors.ts'
import { ProcessRunner } from '../../../node/process-runner.ts'
import { PublishAuth, PublishFailed, PublishRejected, PublishTimeout, PublishUsage } from '../../errors.ts'

// `ship publish` hands the prepared build folder to Ruken's own `ruken publish` (vendor/ruken/ruken-cli, built
// at the RukenApp commit vendor/ruken/README.md names). Ruken's CLI packs the folder deterministically, runs
// Ruken's build validation, uploads, waits for Ruken's checks and prints where the build is served. AF does
// none of that itself, so whatever Ruken accepts is what AF ships. Exit codes are Ruken's
// (`tooling/ruken-cli/src/run.ts`).

/**
 * What `publishToRuken` needs: the prepared build folder, the game's folder, Ruken's site and token, and
 * whether to activate the build.
 */
export interface PublishInput {
  /** The prepared build folder (it already has its `ruken.toml`). */
  readonly distDir: string
  /** Where Ruken's CLI reads and writes `.ruken/project.json` (the game's own folder). */
  readonly cwd: string
  /** The Ruken site, e.g. `http://localhost:5173` for Ruken's local stack. */
  readonly api: string
  /** A Ruken developer token. Passed in the environment, never on the command line. */
  readonly token: string
  /** Make the build the game's active build once Ruken's checks pass. */
  readonly activate: boolean
  /** The game's public id; otherwise Ruken uses `.ruken/project.json` or registers the game. */
  readonly game?: string | undefined
  /** Ruken's CLI entry; defaults to the vendored `@ruken/cli`. */
  readonly cliPath?: string | undefined
}

export type PublishError =
  | PublishRejected
  | PublishUsage
  | PublishAuth
  | PublishTimeout
  | PublishFailed
  | ProcessError

/**
 * The `ruken` bin of the vendored `@ruken/cli` package. The published `@mcthaydt/automata-tools` carries a copy of
 * Ruken's built CLI in `dist/vendor/ruken-cli/`; every built module sits directly in
 * `dist/`, so the copy is `./vendor/ruken-cli/cli.js` next to it. Running from `src` in the workspace there is
 * no copy, and the workspace's `@ruken/cli` dev dependency is used instead (`dist/cli.js`, next to its
 * `dist/index.js`). `moduleUrl` and `exists` are parameters only so tests can stand in for a built package.
 */
export function rukenCliPath(
  moduleUrl: string = import.meta.url,
  exists: (path: string) => boolean = existsSync,
): string {
  const copy = fileURLToPath(new URL('./vendor/ruken-cli/cli.js', moduleUrl))
  if (exists(copy)) return copy
  // The package only exports an `import` condition, so `require.resolve` cannot find it.
  return join(dirname(fileURLToPath(import.meta.resolve('@ruken/cli'))), 'cli.js')
}

/** Ruken prints `Ready: <url>` or `Active: <url>` as its last word on success (`publish.ts`). */
const SERVED_AT = /^(?:Ready|Active): (\S+)$/m

/**
 * Runs Ruken's own `ruken publish` on a prepared build and returns the URL Ruken says the build is served at
 * (`undefined` when it prints none). Ruken's exit codes become `PublishRejected` (1), `PublishUsage` (2),
 * `PublishAuth` (3), `PublishTimeout` (4) and `PublishFailed` for any other.
 */
export function publishToRuken(
  input: PublishInput,
): Effect.Effect<{ url: string | undefined }, PublishError, ProcessRunner> {
  return Effect.gen(function* () {
    const runner = yield* ProcessRunner
    const args = [input.cliPath ?? rukenCliPath(), 'publish', input.distDir]
    if (input.activate) args.push('--activate')
    if (input.game !== undefined) args.push('--game', input.game)

    const result = yield* runner.run(process.execPath, args, {
      cwd: input.cwd,
      env: { RUKEN_API: input.api, RUKEN_TOKEN: input.token },
      echo: true, // Ruken's checks can take minutes; show its progress as it comes.
    })

    const failure = { exitCode: result.exitCode, output: result.stderr || result.stdout }
    switch (result.exitCode) {
      case 0:
        return { url: SERVED_AT.exec(result.stdout)?.[1] }
      case 1:
        return yield* new PublishRejected(failure)
      case 2:
        return yield* new PublishUsage(failure)
      case 3:
        return yield* new PublishAuth(failure)
      case 4:
        return yield* new PublishTimeout(failure)
      default:
        return yield* new PublishFailed(failure)
    }
  })
}
