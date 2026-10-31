// @mcthaydt/automata-narrative/tools: the narrative content tools (M6.8b). Build time and tests, never in a game bundle:
// they are pure functions over content and the locale's text.
export { type Beat, type BeatsFile, beatSchema, beatsFileSchema } from './beats.schema'
export {
  type Clue,
  type Deduction,
  type HintLadder,
  helpFileSchema,
  type SceneHelp,
} from './help.schema'
