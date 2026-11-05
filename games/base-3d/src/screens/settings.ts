// base-3d's settings: the core settings, so the default Settings screen keeps the player's bindings, quality, audio,
// vibration and camera (turn speed and invert, M4.12). The game has no settings of its own.
import { CORE_SETTINGS, type CoreSettings, type SettingsDef } from '@mcthaydt/automata'

export type Base3dSettings = CoreSettings

export const base3dSettings: SettingsDef<Base3dSettings> = CORE_SETTINGS
