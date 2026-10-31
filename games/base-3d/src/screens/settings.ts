// base-3d's settings (DESIGN.md §12.2): the core settings, so the default Settings screen keeps the player's
// bindings, quality, audio, vibration and camera, plus the game's own `game` record on the player's account, which
// holds Lock mode. The Lock mode section (LockModeSection.svelte) sits in the Settings screen's `settings.sections`
// slot, whose components take no props: it reaches the store through `settingsInPlay`, which the Settings screen
// fills while it is open (screens.ts).
import {
  CORE_SETTINGS,
  type CoreSettings,
  type SettingsDef,
  type SettingsStore,
} from '@mcthaydt/automata-runtime'
import { z } from 'zod'

/** Lock-on by a press that latches until the next (toggle) or for as long as the button is held (hold). */
export const LOCK_MODES = ['toggle', 'hold'] as const
export type LockMode = (typeof LOCK_MODES)[number]

/** The game's own settings: a record saved before one reads as the default, Toggle. */
const gameSettingsSchema = z
  .object({ lockMode: z.enum(LOCK_MODES).catch('toggle') })
  .catch({ lockMode: 'toggle' as const })
type GameSettings = z.output<typeof gameSettingsSchema>

export type Base3dSettings = CoreSettings & { readonly game: GameSettings }

/** The `settings` save as base-3d keeps it: the core record's fields and version, and `game`. */
export const base3dSettings: SettingsDef<Base3dSettings> = {
  ...CORE_SETTINGS,
  schema: CORE_SETTINGS.schema.and(z.object({ game: gameSettingsSchema.default({ lockMode: 'toggle' }) })),
  defaults: { ...CORE_SETTINGS.defaults, game: { lockMode: 'toggle' } },
}

/** The player's Lock mode in a settings record, Toggle where it holds none. */
export function lockModeOf(record: unknown): LockMode {
  const game = typeof record === 'object' && record !== null ? (record as { game?: unknown }).game : undefined
  return gameSettingsSchema.parse(game).lockMode
}

/** The settings store while the Settings screen is open; undefined otherwise. */
export const settingsInPlay: { store: SettingsStore<unknown> | undefined } = { store: undefined }
