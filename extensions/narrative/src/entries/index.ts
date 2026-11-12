// @automataframework/narrative: the narrative extension: its content kinds and its sim, re-exported.

export {
  type NarrativeExtension,
  type NarrativeExtensionOptions,
  narrativeExtension,
} from '../app/narrative.extension'
export { default as DialogueBox } from '../features/box/DialogueBox.svelte'
export { default as LineBox } from '../features/box/LineBox.svelte'
export {
  DEFAULT_RATE,
  prefersReducedMotion,
  type TypedView,
  type TypingOptions,
  typedFor,
} from '../features/box/typing'
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
