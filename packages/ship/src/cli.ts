#!/usr/bin/env node
// `automata-ship`: the ship lane's command line (ship spec §3). Each command is a thin wrapper over the
// Effect programs in this package; this file only reads the environment, loads the game's ship.config.ts
// and prints results and errors.
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FilesLive, ProcessRunner, ProcessRunnerLive } from '@mcthaydt/automata-node'
import { Effect, Layer } from 'effect'
import { type CliCommand, parseCliArgs, USAGE } from './cli-args.ts'
import type { ShipConfig } from './config/ship-config.ts'
import { deployDev } from './deploy/deploy-dev.ts'
import { prepareBuild } from './prepare/prepare-build.ts'
import { findExecutable } from './publish/find-executable.ts'
import { ITCH_FIRST_PUSH_CHECKLIST, publishToItch } from './publish/publish-to-itch.ts'
import { publishToRuken } from './publish/publish-to-ruken.ts'
import { testRemote } from './remote/test-remote.ts'
import { prepareItch } from './targets/prepare-itch.ts'

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
  command: Exclude<CliCommand, { command: 'usage' }>,
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

  // itch.io (PUB spec §4): ship checks and zips the given build, and butler pushes it. Ruken is untouched.
  if (command.command !== 'deploy-dev' && command.target === 'itch') {
    if (command.command === 'prepare') {
      return Effect.map(
        prepareItch({ distDir, config, tag: command.tag }),
        (result) => `wrote ${result.zipPath}`,
      )
    }
    const publish = publishToItch({
      distDir,
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

  const prepare = prepareBuild({ distDir, config, tag: command.tag })
  if (command.command === 'prepare') {
    return Effect.provide(
      Effect.map(prepare, (result) => `wrote ${result.manifestPath}`),
      layers,
    )
  }
  if (command.command === 'publish') {
    const api = setting('RUKEN_API')
    const token = setting('RUKEN_TOKEN')
    const publish = Effect.andThen(prepare, () =>
      publishToRuken({ distDir, cwd, api, token, activate: command.activate, game: command.game }),
    )
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

const command = parseCliArgs(process.argv.slice(2))
if (command.command === 'usage') {
  process.stderr.write(`${command.problem}\n\n${USAGE}\n`)
  process.exitCode = 2
} else {
  try {
    const result = await Effect.runPromise(Effect.either(await program(command)))
    if (result._tag === 'Right') {
      process.stdout.write(`${result.right}\n`)
    } else {
      process.stderr.write(`${result.left.message}\n`)
      process.exitCode = exitCodeFor(result.left)
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = error instanceof SettingMissing ? 2 : 1
  }
}
