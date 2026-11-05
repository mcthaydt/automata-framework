import { z } from 'zod'

// The `itch` section of a game's ship.config.ts. butler names a project `user/game` in lower case
// (https://itch.io/docs/butler/pushing.html), and a channel is a lower-case slug such as `html5`.

/** What a game writes in `ship.config.ts`. */
export interface ItchConfig {
  /** The itch.io project as butler names it: `user/game`, lower case. */
  readonly project: string
  /** The butler channel. Defaults to `html5`. */
  readonly channel?: string | undefined
  /**
   * The butler channel of each desktop bundle (`publish --target itch --from tauri`). Each defaults to
   * its OS's name: `linux`, `mac`, `windows`.
   */
  readonly downloads?:
    | {
        readonly linux?: string | undefined
        readonly mac?: string | undefined
        readonly windows?: string | undefined
      }
    | undefined
}

/** The checked settings, with the channel filled in. */
export interface ItchSettings {
  readonly project: string
  readonly channel: string
  readonly downloads: { readonly linux: string; readonly mac: string; readonly windows: string }
}

const SLUG = /^[a-z0-9][a-z0-9._-]*$/

/** Checks a game's `itch` section: `project` is `user/game` in lower case, and `channel` defaults to `html5`. */
export const itchConfigSchema: z.ZodType<ItchSettings, ItchConfig> = z.object({
  project: z
    .string()
    .regex(
      /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/,
      'must be the lower-case itch.io project, user/game',
    ),
  channel: z.string().regex(SLUG, 'must be a lower-case channel name such as html5').default('html5'),
  downloads: z
    .object({
      linux: z.string().regex(SLUG, 'must be a lower-case channel name such as linux').default('linux'),
      mac: z.string().regex(SLUG, 'must be a lower-case channel name such as mac').default('mac'),
      windows: z.string().regex(SLUG, 'must be a lower-case channel name such as windows').default('windows'),
    })
    .default({ linux: 'linux', mac: 'mac', windows: 'windows' }),
})
