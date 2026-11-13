import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { Effect } from 'effect'
import type { ProcessError } from '../../../node/errors.ts'
import type { ProcessRunnerService, RunResult } from '../../../node/process-runner.ts'
import { TauriToolchainMissing } from '../../errors.ts'
import { findExecutable } from '../../publish/find-executable.ts'

// What a desktop build needs on the machine before anything is written: Rust, on Linux the WebKitGTK libraries, and
// the game's own Tauri CLI. Each missing tool is reported in plain words with the one command that installs it,
// because `tauri build` says the same thing as a linker error several minutes in.

/**
 * The `@tauri-apps/cli` a desktop game installs as a dev dependency, named when it is missing: released 2026-10-14,
 * at least 14 days before it was chosen (2.12.4 was not), and the release the adapter's `@tauri-apps/api` pairs with.
 */
export const TAURI_CLI = '@tauri-apps/cli@2.12.3'

/** The OS a desktop build is for; Tauri builds only for the one it runs on. */
export type DesktopOs = 'linux' | 'macos' | 'windows'

/** The one command that installs Rust: rustup's installer, or its winget package on Windows. */
const RUST_INSTALL: Readonly<Record<DesktopOs, string>> = {
  linux: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh",
  macos: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh",
  windows: 'winget install --id Rustlang.Rustup -e',
}

/**
 * Tauri 2's Linux prerequisites on Debian and Ubuntu (https://v2.tauri.app/start/prerequisites/#linux), all of them:
 * WebKitGTK alone compiles, then fails to link without the rest.
 */
export const LINUX_PACKAGES =
  'libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev'

/** A message a person can act on: what is missing, the command on its own line, and what to do after. */
const missingMessage = (lead: string, command: string, after = 'then run this again.'): string =>
  `${lead}\n  ${command}\n${after}`

/** A run that could not start (not installed) reads as a failed one: either way the tool is not there. */
const exitCodeOf = (run: Effect.Effect<RunResult, ProcessError>): Effect.Effect<number> =>
  run.pipe(
    Effect.map((result) => result.exitCode),
    Effect.catchTag('ProcessError', () => Effect.succeed(127)),
  )

/** Cargo, then on Linux the WebKitGTK headers: what `tauri build` needs and says unclearly when it is missing. */
export function checkToolchain(
  runner: ProcessRunnerService,
  os: DesktopOs,
): Effect.Effect<void, TauriToolchainMissing> {
  return Effect.gen(function* () {
    if ((yield* exitCodeOf(runner.run('cargo', ['--version']))) !== 0) {
      return yield* new TauriToolchainMissing({
        missing: 'cargo',
        message: missingMessage(
          'Rust is not installed, and a desktop build needs it. Install it with:',
          RUST_INSTALL[os],
          'then run this again in a new terminal, so it finds cargo.',
        ),
      })
    }
    if (os !== 'linux') return
    if ((yield* exitCodeOf(runner.run('pkg-config', ['--exists', 'webkit2gtk-4.1']))) !== 0) {
      return yield* new TauriToolchainMissing({
        missing: 'webkit2gtk-4.1',
        message: missingMessage(
          'The Linux desktop libraries (WebKitGTK 4.1 and the ones beside it) are not installed. On Debian or Ubuntu, install them with:',
          `sudo apt install ${LINUX_PACKAGES}`,
          'then run this again. Other Linux: https://v2.tauri.app/start/prerequisites/#linux',
        ),
      })
    }
  })
}

/** The game's own `tauri` first, then one on the path. */
export function locateTauri(
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
      message: missingMessage(
        'The Tauri command-line tool is not installed in this game. Install it with:',
        `pnpm add -D ${TAURI_CLI}`,
      ),
    }),
  )
}
