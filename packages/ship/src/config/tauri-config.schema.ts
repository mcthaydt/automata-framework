import { z } from 'zod'

// The `tauri` section of a game's ship.config.ts (DIST spec §6.3): what the desktop build needs beyond the game config.

/** What a game writes in `ship.config.ts` to build for the desktop. */
export interface TauriConfig {
  /**
   * The app's reverse-DNS identifier, unique to the game (`dev.mcthaydt.emberwick`): letters, digits and hyphens in
   * two or more dot-separated parts, the first starting with a letter, and not ending in `.app`
   * (https://v2.tauri.app/reference/config/#identifier).
   */
  readonly identifier: string
  /** A square PNG of at least 512 px for the app's icon, relative to the game's folder. Left out, ship draws one. */
  readonly icon?: string | undefined
}

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9-]*(\.[A-Za-z0-9-]+)+$/

/** Checks a game's `tauri` section. */
export const tauriConfigSchema: z.ZodType<TauriConfig> = z.object({
  identifier: z
    .string()
    .regex(IDENTIFIER, 'must be reverse-DNS, such as dev.example.my-game')
    .refine((identifier) => !identifier.endsWith('.app'), 'must not end in .app'),
  icon: z
    .string()
    .regex(/\.png$/, 'must be a .png file')
    .optional(),
})
