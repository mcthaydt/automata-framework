import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { Effect } from 'effect'
import { type FileError, type ProcessError, tryFile } from '../../../node/errors.ts'
import { ProcessRunner, type ProcessRunnerService } from '../../../node/process-runner.ts'
import type { ShipConfig } from '../../config/ship-config.ts'
import type { TauriConfig } from '../../config/tauri-config.schema.ts'
import {
  type Pixi3dExtrasInBuild,
  type Pixi3dInPublicBuild,
  type SecretInBuild,
  TauriBuildFailed,
  TauriBuildInvalid,
  TauriToolchainMissing,
  type VersionMismatch,
} from '../../errors.ts'
import { buildFiles } from '../../prepare/build-files.ts'
import { checkTag, scanBuild } from '../../prepare/build-scans.ts'
import { findExecutable } from '../../publish/find-executable.ts'
import { checkTauriEntry, checkTauriVersion, findEvalInCsp, tauriCsp, tauriSettings } from './tauri-checks.ts'
import { tauriIconPng } from './tauri-icon.ts'
import { tauriProjectFiles } from './tauri-project.ts'

/**
 * The `@tauri-apps/cli` a desktop game installs as a dev dependency, named when it is missing: released 2026-10-14,
 * at least 14 days before it was chosen (2.12.4 was not), and the release the adapter's `@tauri-apps/api` pairs with.
 */
export const TAURI_CLI = '@tauri-apps/cli@2.12.3'

/** What `prepareTauri` builds: the web build, the game's folder, its config, and the release tag. */
export interface PrepareTauriInput {
  /** The web build (`vite build --mode tauri`). It is checked and loaded as it is; nothing is written into it. */
  readonly distDir: string
  /** The game's folder: the project goes to `.automata/tauri/`, the bundles to `dist-tauri/` beside the build. */
  readonly gameDir: string
  readonly config: ShipConfig
  readonly tag?: string | undefined
  /** The OS to build for, which must be the one this runs on (Tauri does not cross-build). Default: this one. */
  readonly platform?: NodeJS.Platform | undefined
  /** Where to look for `tauri` when the game has none installed. Default: `PATH`. */
  readonly pathEnv?: string | undefined
}

/** Every way `prepareTauri` can fail, each before or instead of writing bundles. */
export type PrepareTauriError =
  | VersionMismatch
  | TauriBuildInvalid
  | SecretInBuild
  | Pixi3dInPublicBuild
  | Pixi3dExtrasInBuild
  | TauriToolchainMissing
  | TauriBuildFailed
  | FileError
  | ProcessError

/** Each OS's bundles: `tauri build --bundles` names, with the folder and extension Tauri writes each to. */
const BUNDLES: Readonly<Record<'linux' | 'macos' | 'windows', readonly { kind: string; ext: string }[]>> = {
  linux: [
    { kind: 'deb', ext: '.deb' },
    { kind: 'appimage', ext: '.AppImage' },
  ],
  macos: [{ kind: 'dmg', ext: '.dmg' }],
  windows: [
    { kind: 'nsis', ext: '.exe' },
    { kind: 'msi', ext: '.msi' },
  ],
}

const osOf = (platform: NodeJS.Platform): keyof typeof BUNDLES =>
  platform === 'darwin' ? 'macos' : platform === 'win32' ? 'windows' : 'linux'

/**
 * Builds the desktop bundles for this OS. In order, and stopping at the first that fails: the
 * release tag; the `tauri` section, a semver version, the `index.html` entry and a CSP without eval; the public-build
 * scans (secrets, `@pixi/3d`); the toolchain (`cargo`, WebKitGTK on Linux, the `tauri` CLI). Only then is the
 * project written to `<game>/.automata/tauri/` (its `target/` cache is kept between builds), `tauri build` run
 * there with its output shown, and each bundle copied to `<game>/dist-tauri/<id>-<version>-<os>-<kind><ext>`.
 */
export function prepareTauri(
  input: PrepareTauriInput,
): Effect.Effect<{ bundles: string[] }, PrepareTauriError, ProcessRunner> {
  return Effect.gen(function* () {
    const { distDir, gameDir, config, tag } = input
    const platform = input.platform ?? process.platform
    const os = osOf(platform)
    yield* checkTag(config.game.version, tag)
    const settings = yield* checkBuildForTauri(distDir, config)

    // A desktop build is published, as an itch.io page is: the same scans.
    yield* scanBuild({ distDir, gameDir })

    const runner = yield* ProcessRunner
    yield* checkToolchain(runner, os)
    const tauri = yield* locateTauri(gameDir, platform, input.pathEnv)

    const project = join(gameDir, '.automata/tauri')
    const srcTauri = join(project, 'src-tauri')
    yield* writeProject(srcTauri, relative(srcTauri, distDir), gameDir, config, settings)

    const kinds = BUNDLES[os]
    const build = yield* runner.run(tauri, ['build', '--bundles', kinds.map((each) => each.kind).join(',')], {
      cwd: project,
      echo: true,
    })
    if (build.exitCode !== 0)
      return yield* new TauriBuildFailed({ exitCode: build.exitCode, stderr: build.stderr })

    const bundles = yield* copyBundles(srcTauri, join(gameDir, 'dist-tauri'), config, os)
    return { bundles }
  })
}

/** The `tauri` section, a semver version, the entry page and a CSP without eval; every problem is reported at once. */
function checkBuildForTauri(
  distDir: string,
  config: ShipConfig,
): Effect.Effect<TauriConfig, TauriBuildInvalid | FileError> {
  return Effect.gen(function* () {
    const { settings, problems: settingProblems } = tauriSettings(config)
    const files = yield* tryFile(distDir, () => buildFiles(distDir))
    const problems = [
      ...settingProblems,
      ...checkTauriVersion(config.game.version),
      ...checkTauriEntry(files, config.game.entry),
      ...findEvalInCsp(tauriCsp(config)),
    ]
    if (problems.length > 0 || settings === undefined) return yield* new TauriBuildInvalid({ problems })
    return settings
  })
}

/** Cargo, then on Linux the WebKitGTK headers: what `tauri build` needs and says unclearly when it is missing. */
function checkToolchain(
  runner: ProcessRunnerService,
  os: keyof typeof BUNDLES,
): Effect.Effect<void, TauriToolchainMissing | ProcessError> {
  return Effect.gen(function* () {
    const cargo = yield* runner.run('cargo', ['--version'])
    if (cargo.exitCode !== 0) {
      return yield* new TauriToolchainMissing({
        missing: 'cargo',
        message: 'cargo is not installed: install Rust from https://rustup.rs, then build again',
      })
    }
    if (os !== 'linux') return
    const webkit = yield* runner.run('pkg-config', ['--exists', 'webkit2gtk-4.1'])
    if (webkit.exitCode !== 0) {
      return yield* new TauriToolchainMissing({
        missing: 'webkit2gtk-4.1',
        message:
          'WebKitGTK 4.1 headers are not installed: on Debian or Ubuntu, apt install libwebkit2gtk-4.1-dev libsoup-3.0-dev (https://v2.tauri.app/start/prerequisites/)',
      })
    }
  })
}

/** The game's own `tauri` first, then one on the path. */
function locateTauri(
  gameDir: string,
  platform: NodeJS.Platform,
  pathEnv: string | undefined,
): Effect.Effect<string, TauriToolchainMissing> {
  const installed = join(gameDir, 'node_modules/.bin', platform === 'win32' ? 'tauri.cmd' : 'tauri')
  const tauri = existsSync(installed) ? installed : findExecutable('tauri', pathEnv, platform)
  if (tauri !== undefined) return Effect.succeed(tauri)
  return Effect.fail(
    new TauriToolchainMissing({
      missing: 'tauri',
      message: `the tauri CLI is not installed: add ${TAURI_CLI} to the game's devDependencies`,
    }),
  )
}

/** Writes the generated Tauri project's files, and the game's icon (or a plain one) beside them. */
function writeProject(
  srcTauri: string,
  distFromProject: string,
  gameDir: string,
  config: ShipConfig,
  settings: TauriConfig,
): Effect.Effect<void, FileError> {
  return Effect.gen(function* () {
    for (const [path, text] of Object.entries(tauriProjectFiles(config, settings, distFromProject))) {
      yield* tryFile(join(srcTauri, path), () => {
        mkdirSync(dirname(join(srcTauri, path)), { recursive: true })
        writeFileSync(join(srcTauri, path), text)
      })
    }
    const icon = join(srcTauri, 'icons/icon.png')
    yield* tryFile(icon, () => {
      mkdirSync(dirname(icon), { recursive: true })
      if (settings.icon === undefined) writeFileSync(icon, tauriIconPng(512))
      else copyFileSync(join(gameDir, settings.icon), icon)
    })
  })
}

/** Copies each bundle Tauri wrote to `out`, named for the game, its version, the OS and the kind; returns them sorted. */
function copyBundles(
  srcTauri: string,
  out: string,
  config: ShipConfig,
  os: keyof typeof BUNDLES,
): Effect.Effect<string[], FileError> {
  return Effect.gen(function* () {
    const bundleRoot = join(srcTauri, 'target/release/bundle')
    const bundles: string[] = []
    for (const { kind, ext } of BUNDLES[os]) {
      const folder = join(bundleRoot, kind)
      const made = yield* tryFile(folder, () =>
        existsSync(folder) ? readdirSync(folder).filter((name) => name.endsWith(ext)) : [],
      )
      for (const name of made) {
        const target = join(out, `${config.game.id}-${config.game.version}-${os}-${kind}${ext}`)
        yield* tryFile(target, () => {
          mkdirSync(out, { recursive: true })
          copyFileSync(join(folder, name), target)
        })
        bundles.push(target)
      }
    }
    return bundles.sort()
  })
}
