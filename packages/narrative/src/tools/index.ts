// @mcthaydt/automata-narrative/tools: the narrative content tools (M6.8b). Build time and tests, never in a game bundle:
// they are pure functions over content and the locale's text.
export { type Beat, type BeatsFile, beatSchema, beatsFileSchema } from './beats.schema'
export {
  type BeatReport,
  barkPattern,
  beatCoverage,
  type HintInput,
  type HintProbe,
  type HintSystems,
  hintCheck,
} from './coverage'
export { type DeckLintInput, type DeckRules, lintDeck } from './deck-lint'
export { type DialogueLintInput, type DialogueRules, lintDialogues } from './dialogue-lint'
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
} from './dialogue-paths'
export type { Finding } from './finding'
export { CLUES, currentHint, type HelpInput, helpInputOf, LEVELS, lintHelp } from './help'
export {
  type Clue,
  type Deduction,
  type HintLadder,
  helpFileSchema,
  type SceneHelp,
} from './help.schema'
export { hintProbes } from './hint-probes'
export { type Box, type Boxes, type LintInput, lintNarrative, type Measure, properNouns, wrap } from './lint'
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
} from './traces'
