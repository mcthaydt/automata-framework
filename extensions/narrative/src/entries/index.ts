// @automata/narrative: the narrative extension: its content kinds and its sim, re-exported.

export {
  type NarrativeExtension,
  type NarrativeExtensionOptions,
  narrativeExtension,
} from '../app/narrative.extension'
export {
  beatsContent,
  canonContent,
  dialogueContent,
  helpContent,
  linesContent,
  storyletsContent,
} from '../shared/narrative.content'
export { wordsOf } from '../shared/words'
export * from './sim'
