// @mcthaydt/automata-narrative/sim: dialogue, line records, the canon's shape and storylets (M6 spec §4.7), a sim entry.
export { type Canon, canonSchema, DEFAULT_STANCE } from './canon.schema'
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
} from './dialogue'
export {
  type Choice,
  type DialogueFile,
  type DialogueGraph,
  type DialogueNode,
  dialogueFileSchema,
  dialogueGraphSchema,
} from './dialogue.schema'
export {
  LINE_KINDS,
  type LineKind,
  type LineRecord,
  type LinesFile,
  lineSchema,
  linesFileSchema,
} from './lines.schema'
export { loadNarrative, type NarrativeScene } from './load-narrative'
export { AdvanceCommand, ChooseCommand, StartCommand } from './narrative.command'
export { NarrativeChoices, NarrativeEnded, NarrativeLine, NarrativeStorylet } from './narrative.event'
export { createNarrative, type Narrative } from './narrative.plugin'
export {
  NarrativeDialogue,
  NarrativeEnv,
  NarrativeSceneResource,
  NarrativeStorylets,
} from './narrative.resource'
export type { NarrativeOptions } from './narrative.system'
export {
  parseTrigger,
  type Storylet,
  type StoryletsFile,
  storyletSchema,
  storyletsFileSchema,
  type Trigger,
} from './storylet.schema'
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
} from './storylets'
