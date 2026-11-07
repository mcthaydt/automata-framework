// @automata/narrative/tools: the narrative content tools. Build time and tests, never in a game bundle:
// they are pure functions over content and the locale's text.

export {
  type BeatReport,
  barkPattern,
  beatCoverage,
  type HintInput,
  type HintProbe,
  type HintSystems,
  hintCheck,
} from '../features/tools/coverage'
export { type DeckLintInput, type DeckRules, lintDeck } from '../features/tools/deck-lint'
export { type DialogueLintInput, type DialogueRules, lintDialogues } from '../features/tools/dialogue-lint'
export {
  type Act,
  type Base,
  endingOf,
  type MotifInput,
  type MotifResult,
  motifs,
  type StanceOptions,
  type StanceResult,
  stance,
  walk,
} from '../features/tools/dialogue-paths'
export type { Finding } from '../features/tools/finding'
export { CLUES, currentHint, type HelpInput, helpInputOf, LEVELS, lintHelp } from '../features/tools/help'
export { hintProbes } from '../features/tools/hint-probes'
export {
  type Box,
  type Boxes,
  type LintInput,
  lintNarrative,
  type Measure,
  properNouns,
  wrap,
} from '../features/tools/lint'
export {
  type Coverage,
  coverageOf,
  helpDoc,
  helpFindings,
  lintScene,
  type NarrativeToolsScene,
  screenplayOf,
} from '../features/tools/scene'
export {
  dialogueScreenplay,
  type ScreenplayScene,
  type ScreenplayStorylet,
  screenplay,
  seconds,
  storyletRows,
} from '../features/tools/screenplay'
export {
  type Order,
  type PlayOptions,
  type PlayRoute,
  play,
  saidFirst,
  shown,
  solverRoutes,
  type Trace,
  type TraceEvent,
  type TraceGame,
  traces,
} from '../features/tools/traces'
export { type Beat, type BeatsFile, beatSchema, beatsFileSchema } from '../shared/beats.schema'
export {
  type Clue,
  type Deduction,
  type HintLadder,
  helpFileSchema,
  type SceneHelp,
} from '../shared/help.schema'
