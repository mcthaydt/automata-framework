// The core settings (M4 spec §4.5, §4.8, M4-D8): what a game that declares no `settings` saves, so the Settings
// screen's Controls and Display sections always have a place for the player's choices. A game with settings of its
// own keeps them only when its schema has the same fields: `input: inputSettingsSchema` and
// `display: displaySettingsSchema`.
import { z } from 'zod'
import {
  INPUT_SETTINGS_DEFAULT,
  type InputSettings,
  inputSettingsSchema,
} from '../input/bindings/input-settings.schema.js'
import { DEFAULT_QUALITY, type DisplaySettings, displaySettingsSchema } from './display-settings.schema.js'
import type { SettingsDef } from './migrate-settings.js'

export interface CoreSettings {
  readonly input: InputSettings
  readonly display: DisplaySettings
}

const DEFAULTS: CoreSettings = { input: INPUT_SETTINGS_DEFAULT, display: { quality: DEFAULT_QUALITY } }

const coreSettingsSchema: z.ZodType<CoreSettings> = z.object({
  input: inputSettingsSchema,
  display: displaySettingsSchema.catch(() => ({ quality: DEFAULT_QUALITY })),
})

/** The `settings` save, version 1: the player's bindings (`input`) and graphics quality (`display`). */
export const CORE_SETTINGS: SettingsDef<CoreSettings> = {
  key: 'settings',
  version: 1,
  schema: coreSettingsSchema,
  defaults: DEFAULTS,
}
