// `automata ship`: ship's command line, run by `automata` (`cli.ts`). Each command is a thin wrapper over the
// Effect programs in this package; this file only reads the environment, loads the game's ship.config.ts
// and prints results and errors.
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Effect, Layer } from 'effect'
import { FilesLive } from '../shared/node/files.ts'
import { ProcessRunnerLive } from '../shared/node/process-runner.ts'
import { type CliCommand, parseCliArgs, USAGE } from '../shared/ship/cli-args.ts'
import type { ShipConfig } from '../shared/ship/config/ship-config.ts'
import { checkBuild, prepareBuild } from '../shared/ship/prepare/prepare-build.ts'
import { prepareMode } from '../shared/ship/prepare/prepare-mode.ts'
import { findExecutable } from '../shared/ship/publish/find-executable.ts'
import { publishBuild } from '../shared/ship/publish/publish-build.ts'
import { prepareItch } from '../shared/ship/targets/itch/prepare-itch.ts'
import { publishDownloadsToItch } from '../shared/ship/targets/itch/publish-downloads-to-itch.ts'
import { ITCH_FIRST_PUSH_CHECKLIST, publishToItch } from '../shared/ship/targets/itch/publish-to-itch.ts'
import { prepareTauri } from '../shared/ship/targets/tauri/prepare-tauri.ts'
import { prepareWeb } from '../shared/ship/targets/web/prepare-web.ts'
import { type CliIo, PROCESS_IO } from './cli-io.ts'

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

/** The program's failure: its message, and the exit code when it is not 1 (butler's own, a missing setting's 2). */
type Failure = { readonly message: string; readonly _tag?: string; readonly exitCode?: number }

function exitCodeFor(failure: Failure): number {
  if (failure._tag === 'ButlerFailed' && failure.exitCode !== undefined) return failure.exitCode
  return failure._tag === 'ItchSettingMissing' ? 2 : 1
}

/** What every target's command needs: the game's config, the build folder and the command as typed. */
interface ShipRun {
  readonly config: ShipConfig
  readonly distDir: string
  readonly command: Exclude<CliCommand, { command: 'usage' | 'help' }>
}

type ShipResult = Effect.Effect<string, Failure, never>

const layers = Layer.merge(FilesLive, ProcessRunnerLive)

/** The desktop: ship checks the given build and runs tauri build for this OS. */
function prepareForTauri({ config, distDir, command }: ShipRun): ShipResult {
  return Effect.provide(
    Effect.map(prepareTauri({ distDir, gameDir: cwd, config, tag: command.tag }), (result) =>
      result.bundles.map((bundle) => `wrote ${bundle}`).join('\n'),
    ),
    layers,
  )
}

/** The web: ship checks the given build for the rules every public host shares; there is nothing to pack. */
function prepareForWeb({ config, distDir, command }: ShipRun): ShipResult {
  return Effect.map(
    prepareWeb({ distDir, gameDir: cwd, config, tag: command.tag }),
    (result) => `checked ${result.files} files in ${command.dist}; upload the folder to any static host`,
  )
}

/** itch.io: ship checks and zips the given build, and butler pushes it. Ruken is untouched. */
function shipItch({ config, distDir, command }: ShipRun): ShipResult {
  if (command.command === 'prepare') {
    return Effect.map(
      prepareItch({ distDir, gameDir: cwd, config, tag: command.tag }),
      (result) => `wrote ${result.zipPath}`,
    )
  }
  const apiKey = process.env.BUTLER_API_KEY
  if (command.from === 'tauri') {
    const downloads = publishDownloadsToItch({
      gameDir: cwd,
      config,
      apiKey,
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
    apiKey,
    butlerPath: findExecutable('butler'),
  })
  return Effect.provide(
    Effect.map(publish, (result) =>
      result.firstPush ? `pushed to itch.io\n\n${ITCH_FIRST_PUSH_CHECKLIST}` : 'pushed to itch.io',
    ),
    layers,
  )
}

/**
 * Ruken. `prepare` follows the game's audience, writing no ruken.toml for a private game. `publish --private` checks
 * for Ruken's local stack itself (publishBuild).
 */
function shipRuken({ config, distDir, command }: ShipRun): ShipResult {
  if (command.command === 'prepare') {
    const mode = prepareMode(config)
    const input = { distDir, gameDir: cwd, config, tag: command.tag, audience: mode.audience }
    const done = mode.writeManifest
      ? Effect.map(prepareBuild(input), (result) => `wrote ${result.manifestPath}`)
      : Effect.as(
          checkBuild(input),
          'checked a private build; no ruken.toml written (publish --private ships it)',
        )
    return Effect.provide(done, layers)
  }
  const publish = publishBuild({
    distDir,
    cwd,
    config,
    tag: command.tag,
    api: setting('RUKEN_API'),
    token: setting('RUKEN_TOKEN'),
    activate: command.activate,
    game: command.game,
    private: command.private === true,
  })
  return Effect.provide(
    Effect.map(publish, (result) => result.url ?? 'published'),
    layers,
  )
}

/** Picks the target's program. A missing setting throws here, before any work starts. */
async function program(command: ShipRun['command']): Promise<ShipResult> {
  const run: ShipRun = { command, config: await loadConfig(), distDir: resolve(cwd, command.dist) }
  if (command.command === 'prepare' && command.target === 'tauri') return prepareForTauri(run)
  if (command.command === 'prepare' && command.target === 'web') return prepareForWeb(run)
  if (command.target === 'itch') return shipItch(run)
  return shipRuken(run)
}

/** Runs one ship command (`args` are the words after `automata ship`) and returns the process exit code. */
export async function runShip(args: readonly string[], io: CliIo = PROCESS_IO): Promise<number> {
  const command = parseCliArgs([...args])
  if (command.command === 'help') {
    io.stdout(`${USAGE}\n`)
    return 0
  }
  if (command.command === 'usage') {
    io.stderr(`${command.problem}\n\n${USAGE}\n`)
    return 2
  }
  try {
    const result = await Effect.runPromise(Effect.either(await program(command)))
    if (result._tag === 'Right') {
      io.stdout(`${result.right}\n`)
      return 0
    }
    io.stderr(`${result.left.message}\n`)
    return exitCodeFor(result.left)
  } catch (error) {
    io.stderr(`${error instanceof Error ? error.message : String(error)}\n`)
    return error instanceof SettingMissing ? 2 : 1
  }
}
