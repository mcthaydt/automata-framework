// `automata ship`: ship's command line, run by `automata` (`cli.ts`) and by the old
// `automata-ship` name (`ship-alias.ts`). Each command is a thin wrapper over the
// Effect programs in this package; this file only reads the environment, loads the game's ship.config.ts
// and prints results and errors.
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Effect, Layer } from 'effect'
import { FilesLive } from '../shared/node/files.ts'
import { ProcessRunner, ProcessRunnerLive } from '../shared/node/process-runner.ts'
import { type CliCommand, parseCliArgs, USAGE } from '../shared/ship/cli-args.ts'
import type { ShipConfig } from '../shared/ship/config/ship-config.ts'
import { checkBuild, prepareBuild } from '../shared/ship/prepare/prepare-build.ts'
import { prepareMode } from '../shared/ship/prepare/prepare-mode.ts'
import { findExecutable } from '../shared/ship/publish/find-executable.ts'
import { publishBuild } from '../shared/ship/publish/publish-build.ts'
import { testRemote } from '../shared/ship/remote/test-remote.ts'
import { prepareItch } from '../shared/ship/targets/itch/prepare-itch.ts'
import { publishDownloadsToItch } from '../shared/ship/targets/itch/publish-downloads-to-itch.ts'
import { ITCH_FIRST_PUSH_CHECKLIST, publishToItch } from '../shared/ship/targets/itch/publish-to-itch.ts'
import { deployDev } from '../shared/ship/targets/ruken/deploy-dev.ts'
import { prepareTauri } from '../shared/ship/targets/tauri/prepare-tauri.ts'

const cwd = process.cwd()

/** Thrown for a missing setting, before any work starts. */
class SettingMissing extends Error {}

function setting(name: string): string {
  const value = process.env[name]
  if (value === undefined || value === '') throw new SettingMissing(`${name} is not set`)
  return value
}

async function loadConfig(): Promise<ShipConfig> {
  const module = (await import(pathToFileURL(resolve(cwd, 'ship.config.ts')).href)) as { default: ShipConfig }
  return module.default
}

/** The checked-out commit, for the dev host's build ID and build.json. */
const currentCommit = Effect.gen(function* () {
  const runner = yield* ProcessRunner
  const log = yield* runner.run('git', ['log', '-1', '--format=%H%n%cI'])
  const branch = yield* runner.run('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
  const [sha = '', time = ''] = log.stdout.trim().split('\n')
  const name = branch.stdout.trim()
  return { sha, time: new Date(time), branch: name === 'HEAD' ? undefined : name }
})

/** The program's failure: its message, and the exit code when it is not 1 (butler's own, a missing setting's 2). */
type Failure = { readonly message: string; readonly _tag?: string; readonly exitCode?: number }

function exitCodeFor(failure: Failure): number {
  if (failure._tag === 'ButlerFailed' && failure.exitCode !== undefined) return failure.exitCode
  return failure._tag === 'ItchSettingMissing' ? 2 : 1
}

async function program(
  command: Exclude<CliCommand, { command: 'usage' | 'help' }>,
): Promise<Effect.Effect<string, Failure, never>> {
  const layers = Layer.merge(FilesLive, ProcessRunnerLive)
  if (command.command === 'test-remote') {
    const run = testRemote({ args: command.args, since: new Date().toISOString().replace(/\.\d+Z$/, 'Z') })
    return Effect.provide(
      Effect.map(
        run,
        (result) => `${result.runUrl}\n${result.jobs.map((job) => `  ${job}`).join('\n')}\ngreen`,
      ),
      layers,
    )
  }

  const config = await loadConfig()
  const distDir = resolve(cwd, command.dist)

  // The desktop: ship checks the given build and runs tauri build for this OS.
  if (command.command === 'prepare' && command.target === 'tauri') {
    return Effect.provide(
      Effect.map(prepareTauri({ distDir, gameDir: cwd, config, tag: command.tag }), (result) =>
        result.bundles.map((bundle) => `wrote ${bundle}`).join('\n'),
      ),
      layers,
    )
  }

  // itch.io: ship checks and zips the given build, and butler pushes it. Ruken is untouched.
  if (command.command !== 'deploy-dev' && command.target === 'itch') {
    if (command.command === 'prepare') {
      return Effect.map(
        prepareItch({ distDir, gameDir: cwd, config, tag: command.tag }),
        (result) => `wrote ${result.zipPath}`,
      )
    }
    if (command.from === 'tauri') {
      const downloads = publishDownloadsToItch({
        gameDir: cwd,
        config,
        apiKey: process.env.BUTLER_API_KEY,
        butlerPath: findExecutable('butler'),
      })
      return Effect.provide(
        Effect.map(downloads, (result) => `pushed to itch.io: ${result.pushed.join(', ')}`),
        layers,
      )
    }
    const publish = publishToItch({
      distDir,
      gameDir: cwd,
      config,
      tag: command.tag,
      apiKey: process.env.BUTLER_API_KEY,
      butlerPath: findExecutable('butler'),
    })
    return Effect.provide(
      Effect.map(publish, (result) =>
        result.firstPush ? `pushed to itch.io\n\n${ITCH_FIRST_PUSH_CHECKLIST}` : 'pushed to itch.io',
      ),
      layers,
    )
  }

  // deploy-dev may carry @pixi/3d; `prepare` follows the game's audience, writing no ruken.toml for a private game
  //. `publish --private` checks for Ruken's local stack itself (publishBuild).
  const mode = prepareMode(command.command === 'deploy-dev' ? 'deploy-dev' : 'prepare', config)
  const input = { distDir, gameDir: cwd, config, tag: command.tag, audience: mode.audience }
  const prepare = prepareBuild(input)
  if (command.command === 'prepare') {
    const done = mode.writeManifest
      ? Effect.map(prepare, (result) => `wrote ${result.manifestPath}`)
      : Effect.as(
          checkBuild(input),
          'checked a private build; no ruken.toml written (deploy-dev or publish --private ships it)',
        )
    return Effect.provide(done, layers)
  }
  if (command.command === 'publish') {
    const api = setting('RUKEN_API')
    const token = setting('RUKEN_TOKEN')
    const publish = publishBuild({
      distDir,
      cwd,
      config,
      tag: command.tag,
      api,
      token,
      activate: command.activate,
      game: command.game,
      private: command.private === true,
    })
    return Effect.provide(
      Effect.map(publish, (result) => result.url ?? 'published'),
      layers,
    )
  }
  const target = setting('SHIP_DEV_TARGET')
  const siteUrl = setting('SHIP_DEV_URL')
  const deploy = Effect.gen(function* () {
    yield* prepare
    const commit = yield* currentCommit
    return yield* deployDev({
      distDir,
      commit,
      branch: commit.branch,
      tag: command.tag,
      target,
      siteUrl,
      activate: command.activate,
      sshKeyFile: process.env.SHIP_DEV_SSH_KEY_FILE || undefined,
      knownHostsFile: process.env.SHIP_DEV_KNOWN_HOSTS_FILE || undefined,
    })
  })
  return Effect.provide(
    Effect.map(deploy, (result) => `build ${result.buildId} is at ${result.url}`),
    layers,
  )
}

/** Runs one ship command (`args` are the words after `automata ship`) and returns the process exit code. */
export async function runShip(args: readonly string[]): Promise<number> {
  const command = parseCliArgs([...args])
  if (command.command === 'help') {
    process.stdout.write(`${USAGE}\n`)
    return 0
  }
  if (command.command === 'usage') {
    process.stderr.write(`${command.problem}\n\n${USAGE}\n`)
    return 2
  }
  try {
    const result = await Effect.runPromise(Effect.either(await program(command)))
    if (result._tag === 'Right') {
      process.stdout.write(`${result.right}\n`)
      return 0
    }
    process.stderr.write(`${result.left.message}\n`)
    return exitCodeFor(result.left)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return error instanceof SettingMissing ? 2 : 1
  }
}
