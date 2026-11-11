import { definePlugin, type PluginDef } from '@automata/sim'

/**
 * The game's own sim, the features' defs joined in order. Empty in the blank room; each feature adds its components,
 * commands and systems here as it arrives (`app/` wires features together).
 */
export const scenePlugin: PluginDef = definePlugin({ name: 'scene', defs: [] })
