// @automata/narrative/sim: dialogue, line records, the canon's shape and storylets, a sim entry.
export { type Canon, canonSchema, DEFAULT_STANCE } from '../shared/sim/canon.schema'
export {
  advance,
  applyChoice,
  choose,
  type DialogueState,
  freshDialogue,
  offered,
  type Place,
  passes,
  readerOf,
  settle,
  start,
  type View,
  view,
} from '../shared/sim/dialogue'
export {
  type Choice,
  type DialogueFile,
  type DialogueGraph,
  type DialogueNode,
  dialogueFileSchema,
  dialogueGraphSchema,
} from '../shared/sim/dialogue.schema'
export {
  LINE_KINDS,
  type LineKind,
  type LineRecord,
  type LinesFile,
  lineSchema,
  linesFileSchema,
} from '../shared/sim/lines.schema'
export { loadNarrative, type NarrativeScene } from '../shared/sim/load-narrative'
export { AdvanceCommand, ChooseCommand, StartCommand } from '../shared/sim/narrative.command'
export {
  NarrativeChoices,
  NarrativeEnded,
  NarrativeLine,
  NarrativeStorylet,
} from '../shared/sim/narrative.event'
export { createNarrative, type Narrative } from '../shared/sim/narrative.plugin'
export {
  NarrativeDialogue,
  NarrativeEnv,
  NarrativeSceneResource,
  NarrativeStorylets,
} from '../shared/sim/narrative.resource'
export type { NarrativeOptions } from '../shared/sim/narrative.system'
export { type NarrativeDebugSummary, narrativeDebugSummary } from '../shared/sim/narrative-debug'
export {
  parseTrigger,
  type Storylet,
  type StoryletsFile,
  storyletSchema,
  storyletsFileSchema,
  type Trigger,
} from '../shared/sim/storylet.schema'
export {
  AFTER,
  fresh,
  freshStorylets,
  type HeardVerb,
  type Here,
  type Outcome,
  onStep,
  onSystem,
  onVerb,
  type Play,
  play,
  type Room,
  type StoryletState,
  select,
  storyletReader,
} from '../shared/sim/storylets'
