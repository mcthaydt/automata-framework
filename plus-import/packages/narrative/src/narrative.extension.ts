// The narrative extension (M6 spec §4.7): the plugin and the six content kinds, after sectors (rooms) and puzzle
// (conditions, the `dialogue` and `verb` hooks).
import { defineExtension, type ExtensionDef } from '@mcthaydt/automata-runtime/extension'
import {
  beatsContent,
  canonContent,
  dialogueContent,
  helpContent,
  linesContent,
  storyletsContent,
} from './narrative.content'
import { createNarrative, type Narrative, type NarrativeOptions } from './sim/index'

export interface NarrativeExtension extends Narrative {
  readonly extension: ExtensionDef<'narrative'>
}

export function narrativeExtension(options: NarrativeOptions = {}): NarrativeExtension {
  const narrative = createNarrative(options)
  return {
    ...narrative,
    extension: defineExtension({
      name: 'narrative',
      requires: ['sectors', 'puzzle'],
      sim: [narrative.plugin],
      content: [canonContent, linesContent, dialogueContent, storyletsContent, beatsContent, helpContent],
    }),
  }
}
