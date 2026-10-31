import { type ProcessError, ProcessRunner } from '@mcthaydt/automata-node'
import { Effect } from 'effect'
import { type ItchSettings, itchConfigSchema } from '../../config/itch-config.schema.ts'
import type { ShipConfig } from '../../config/ship-config.ts'
import { ButlerFailed, ItchSettingMissing } from '../../errors.ts'
import { type PrepareItchError, prepareItch } from './prepare-itch.ts'

// `automata-ship publish --target itch` (PUB spec §4): prepare the build for itch.io, then hand the folder to
// itch.io's own uploader, butler (https://itch.io/docs/butler/pushing.html). butler diffs against the
// channel's last build, so it pushes the folder, not the zip. Its output is shown as it runs and its exit code
// becomes ship's; nothing is retried (§8).

/** What `publishToItch` needs: the built folder, the ship config, the tag, the key and where butler is. */
export interface PublishItchInput {
  /** The built game folder. */
  readonly distDir: string
  readonly config: ShipConfig
  /** The release tag being built, when there is one (`v1.2.3`). */
  readonly tag?: string | undefined
  /** The game's folder, for the secret scan's `.env*` values (see `PrepareItchInput.gameDir`). */
  readonly gameDir?: string | undefined
  /** `BUTLER_API_KEY`. Passed in butler's environment, never on its command line. */
  readonly apiKey: string | undefined
  /** butler as found on PATH (`findExecutable('butler')`), or undefined when it is not installed. */
  readonly butlerPath: string | undefined
}

export type PublishItchError = ItchSettingMissing | PrepareItchError | ButlerFailed | ProcessError

/**
 * The one-time page settings butler cannot make (PUB spec §6), printed after a channel's first push. The
 * "Publish to itch.io" guide (PUB.5) carries the same list.
 */
export const ITCH_FIRST_PUSH_CHECKLIST: string = `This was the channel's first push. On the itch.io project's Edit page, once:
  1. Set "Kind of project" to HTML (the default is "Downloadable").
  2. On the uploaded html5 build, tick "This file will be played in the browser".
  3. Embed options:
     - Embed in page: the game's size, scaled to fit, or "Click to launch in fullscreen";
     - Mobile friendly: on, with the orientation the game supports;
     - Fullscreen button: on;
     - Automatically start on page load: off, so audio can start on a click.`

// butler prints this when the channel has no build yet, and "last build is N" otherwise
// (itchio/butler cmd/push/push.go, master, read 2026-10-16). Its progress lines may go to stdout or stderr.
const FIRST_PUSH = /For channel `[^`]+`: pushing first build/

const NO_ITCH_SECTION =
  "ship.config.ts has no itch section. Add itch: { project: 'user/game' }, the lower-case user and game of the project's page (https://user.itch.io/game)."
const NO_KEY = `BUTLER_API_KEY is not set. Run \`butler login\` once, then copy the key from butler_creds
(Linux ~/.config/itch/butler_creds, macOS ~/Library/Application Support/itch/butler_creds) into BUTLER_API_KEY,
or into the repository's BUTLER_API_KEY secret for CI. See https://itch.io/docs/butler/login.html`
const NO_BUTLER = `butler is not on PATH. Install it from https://itch.io/docs/butler/installing.html
(CI: download it from https://broth.itch.zone/butler).`

/**
 * Prepares the build for itch.io (every check of `prepareItch`), then pushes the folder with butler. It fails
 * before any zip or process when the `itch` section, the key or butler is missing, relays butler's exit code, and
 * retries nothing. `firstPush` is true when butler says the channel had no build yet.
 */
export function publishToItch(
  input: PublishItchInput,
): Effect.Effect<{ firstPush: boolean }, PublishItchError, ProcessRunner> {
  return Effect.gen(function* () {
    // Everything that can be missing is found before prepare writes a zip or any process starts.
    const { settings, butlerPath, apiKey } = yield* itchPushSettings(input)

    yield* prepareItch({
      distDir: input.distDir,
      config: input.config,
      tag: input.tag,
      gameDir: input.gameDir,
    })

    const { project, channel } = settings
    const runner = yield* ProcessRunner
    const result = yield* runner.run(
      butlerPath,
      [
        'push',
        input.distDir,
        `${project}:${channel}`,
        '--userversion',
        input.config.game.version,
        '--if-changed',
      ],
      { env: { BUTLER_API_KEY: apiKey }, echo: true },
    )
    if (result.exitCode !== 0) return yield* new ButlerFailed({ exitCode: result.exitCode })
    return { firstPush: FIRST_PUSH.test(result.stdout) || FIRST_PUSH.test(result.stderr) }
  })
}

/**
 * The checked `itch` section, butler and the key, or the first that is missing: what every butler push needs, found
 * before anything is written or started.
 */
export function itchPushSettings(
  input: Pick<PublishItchInput, 'config' | 'apiKey' | 'butlerPath'>,
): Effect.Effect<{ settings: ItchSettings; butlerPath: string; apiKey: string }, ItchSettingMissing> {
  return Effect.gen(function* () {
    if (input.config.itch === undefined) {
      return yield* new ItchSettingMissing({ setting: 'itch', message: NO_ITCH_SECTION })
    }
    const parsed = itchConfigSchema.safeParse(input.config.itch)
    if (!parsed.success) {
      const problems = parsed.error.issues.map((issue) => `itch.${issue.path.join('.')}: ${issue.message}`)
      return yield* new ItchSettingMissing({
        setting: 'itch',
        message: `ship.config.ts ${problems.join('\n')}`,
      })
    }
    if (input.apiKey === undefined || input.apiKey === '') {
      return yield* new ItchSettingMissing({ setting: 'BUTLER_API_KEY', message: NO_KEY })
    }
    if (input.butlerPath === undefined) {
      return yield* new ItchSettingMissing({ setting: 'butler', message: NO_BUTLER })
    }

    return { settings: parsed.data, butlerPath: input.butlerPath, apiKey: input.apiKey }
  })
}
