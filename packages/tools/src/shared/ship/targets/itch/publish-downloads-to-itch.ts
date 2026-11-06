import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { Effect } from 'effect'
import { type FileError, type ProcessError, tryFile } from '../../../node/errors.ts'
import { ProcessRunner } from '../../../node/process-runner.ts'
import type { ShipConfig } from '../../config/ship-config.ts'
import { ButlerFailed, ItchDownloadsMissing, type ItchSettingMissing } from '../../errors.ts'
import { itchPushSettings } from './publish-to-itch.ts'

/*
 * `automata ship publish --target itch --from tauri`: the desktop bundles `prepare --target tauri`
 * wrote to `dist-tauri/` go to itch.io as Downloadable files, one butler channel per OS. butler pushes a folder, so
 * each bundle is staged alone in `dist-tauri/.itch/<channel>/`.
 */

/** What `publishDownloadsToItch` needs: the game's folder, its config, the key and where butler is. */
export interface PublishDownloadsInput {
  readonly gameDir: string
  readonly config: ShipConfig
  /** `BUTLER_API_KEY`. Passed in butler's environment, never on its command line. */
  readonly apiKey: string | undefined
  readonly butlerPath: string | undefined
}

/** Every way `publishDownloadsToItch` can fail, each stopping the pushes. */
export type PublishDownloadsError =
  | ItchSettingMissing
  | ItchDownloadsMissing
  | ButlerFailed
  | FileError
  | ProcessError

/** The one bundle each OS publishes, by the name `prepareTauri` gives it, and the `itch.downloads` key of its channel. */
const PUBLISHED = [
  { os: 'linux', kind: 'appimage', ext: '.AppImage', channel: 'linux' },
  { os: 'macos', kind: 'dmg', ext: '.dmg', channel: 'mac' },
  { os: 'windows', kind: 'nsis', ext: '.exe', channel: 'windows' },
] as const

/**
 * Pushes this version's bundles from `dist-tauri/`, one per OS, each to its channel (`itch.downloads`, default
 * `linux`, `mac`, `windows`), and answers the channels pushed. The section, the key, butler and at least one bundle
 * are checked before anything is staged or started; a butler failure stops the pushes after it.
 */
export function publishDownloadsToItch(
  input: PublishDownloadsInput,
): Effect.Effect<{ pushed: string[] }, PublishDownloadsError, ProcessRunner> {
  return Effect.gen(function* () {
    const { settings, butlerPath, apiKey } = yield* itchPushSettings(input)
    const { id, version } = input.config.game
    const bundlesDir = join(input.gameDir, 'dist-tauri')
    const present = yield* tryFile(bundlesDir, () => (existsSync(bundlesDir) ? readdirSync(bundlesDir) : []))
    const found = PUBLISHED.flatMap((bundle) => {
      const file = `${id}-${version}-${bundle.os}-${bundle.kind}${bundle.ext}`
      return present.includes(file) ? [{ file, channel: settings.downloads[bundle.channel] }] : []
    })
    if (found.length === 0) {
      return yield* new ItchDownloadsMissing({
        message: `no desktop bundle of ${id} ${version} in dist-tauri/: run automata ship prepare --target tauri first`,
      })
    }

    const runner = yield* ProcessRunner
    const pushed: string[] = []
    for (const { file, channel } of found) {
      const staged = join(bundlesDir, '.itch', channel)
      yield* tryFile(staged, () => {
        rmSync(staged, { recursive: true, force: true })
        mkdirSync(staged, { recursive: true })
        copyFileSync(join(bundlesDir, file), join(staged, file))
      })
      const result = yield* runner.run(
        butlerPath,
        ['push', staged, `${settings.project}:${channel}`, '--userversion', version, '--if-changed'],
        { env: { BUTLER_API_KEY: apiKey }, echo: true },
      )
      if (result.exitCode !== 0) return yield* new ButlerFailed({ exitCode: result.exitCode })
      pushed.push(channel)
    }
    return { pushed }
  })
}
