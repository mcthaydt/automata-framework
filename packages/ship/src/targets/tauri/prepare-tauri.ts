import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { FileError, type ProcessError, ProcessRunner } from '@mcthaydt/automata-node'
import { Effect } from 'effect'
import type { ShipConfig } from '../../config/ship-config.ts'
import {
  Pixi3dExtrasInBuild,
  Pixi3dInPublicBuild,
  SecretInBuild,
  TauriBuildFailed,
  TauriBuildInvalid,
  TauriToolchainMissing,
  VersionMismatch,
} from '../../errors.ts'
import { buildFiles } from '../../prepare/build-files.ts'
import { checkVersion } from '../../prepare/check-version.ts'
import { findPixi3d } from '../../prepare/pixi3d-markers.ts'
import { findSecretsInBuild, readEnvValues } from '../../prepare/secret-scan.ts'
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
 * Builds the desktop bundles for this OS (DIST spec §6.2). In order, and stopping at the first that fails: the
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
    const attempt = <A>(path: string, run: () => A) =>
      Effect.try({ try: run, catch: (cause) => new FileError({ path, cause }) })

    const mismatch = checkVersion(config.game.version, tag)
    if (mismatch !== undefined && tag !== undefined) {
      return yield* new VersionMismatch({ version: config.game.version, tag, message: mismatch })
    }
    const { settings, problems: settingProblems } = tauriSettings(config)
    const files = yield* attempt(distDir, () => buildFiles(distDir))
    const problems = [
      ...settingProblems,
      ...checkTauriVersion(config.game.version),
      ...checkTauriEntry(files, config.game.entry),
      ...findEvalInCsp(tauriCsp(config)),
    ]
    if (problems.length > 0 || settings === undefined) return yield* new TauriBuildInvalid({ problems })

    // A desktop build is published, as an itch.io page is: the same scans (QB.2, X-b, S7-g).
    const secrets = yield* attempt(distDir, () => findSecretsInBuild(distDir, readEnvValues(gameDir)))
    if (secrets.length > 0) return yield* new SecretInBuild({ found: secrets })
    const pixi3d = yield* attempt(distDir, () => findPixi3d(distDir))
    if (pixi3d.extras.length > 0) return yield* new Pixi3dExtrasInBuild({ found: pixi3d.extras })
    if (pixi3d.core.length > 0) return yield* new Pixi3dInPublicBuild({ found: pixi3d.core })

    const runner = yield* ProcessRunner
    const cargo = yield* runner.run('cargo', ['--version'])
    if (cargo.exitCode !== 0) {
      return yield* new TauriToolchainMissing({
        missing: 'cargo',
        message: 'cargo is not installed: install Rust from https://rustup.rs, then build again',
      })
    }
    if (os === 'linux') {
      const webkit = yield* runner.run('pkg-config', ['--exists', 'webkit2gtk-4.1'])
      if (webkit.exitCode !== 0) {
        return yield* new TauriToolchainMissing({
          missing: 'webkit2gtk-4.1',
          message:
            'WebKitGTK 4.1 headers are not installed: on Debian or Ubuntu, apt install libwebkit2gtk-4.1-dev libsoup-3.0-dev (https://v2.tauri.app/start/prerequisites/)',
        })
      }
    }
    const installed = join(gameDir, 'node_modules/.bin', platform === 'win32' ? 'tauri.cmd' : 'tauri')
    const tauri = existsSync(installed) ? installed : findExecutable('tauri', input.pathEnv, platform)
    if (tauri === undefined) {
      return yield* new TauriToolchainMissing({
        missing: 'tauri',
        message: `the tauri CLI is not installed: add ${TAURI_CLI} to the game's devDependencies`,
      })
    }

    const project = join(gameDir, '.automata/tauri')
    const srcTauri = join(project, 'src-tauri')
    const generated = tauriProjectFiles(config, settings, relative(srcTauri, distDir))
    for (const [path, text] of Object.entries(generated)) {
      yield* attempt(join(srcTauri, path), () => {
        mkdirSync(dirname(join(srcTauri, path)), { recursive: true })
        writeFileSync(join(srcTauri, path), text)
      })
    }
    const icon = join(srcTauri, 'icons/icon.png')
    yield* attempt(icon, () => {
      mkdirSync(dirname(icon), { recursive: true })
      if (settings.icon === undefined) writeFileSync(icon, tauriIconPng(512))
      else copyFileSync(join(gameDir, settings.icon), icon)
    })

    const kinds = BUNDLES[os]
    const build = yield* runner.run(tauri, ['build', '--bundles', kinds.map((each) => each.kind).join(',')], {
      cwd: project,
      echo: true,
    })
    if (build.exitCode !== 0)
      return yield* new TauriBuildFailed({ exitCode: build.exitCode, stderr: build.stderr })

    const out = join(gameDir, 'dist-tauri')
    const bundleRoot = join(srcTauri, 'target/release/bundle')
    const bundles: string[] = []
    for (const { kind, ext } of kinds) {
      const folder = join(bundleRoot, kind)
      const made = yield* attempt(folder, () =>
        existsSync(folder) ? readdirSync(folder).filter((name) => name.endsWith(ext)) : [],
      )
      for (const name of made) {
        const target = join(out, `${config.game.id}-${config.game.version}-${os}-${kind}${ext}`)
        yield* attempt(target, () => {
          mkdirSync(out, { recursive: true })
          copyFileSync(join(folder, name), target)
        })
        bundles.push(target)
      }
    }
    return { bundles: bundles.sort() }
  })
}
