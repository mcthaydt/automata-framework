// `level-2d` as an extension a 2D game opts into. Narrative, cutscenes, nav and systems are given `level2dPlaces(...)` and
// require this extension (by name) instead of `sectors`.
import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
import { level2dPlugin } from '../shared/sim/level-2d.plugin.ts'

export const level2dExtension: ExtensionDef<'level-2d'> = defineExtension({
  name: 'level-2d',
  sim: [level2dPlugin],
})
