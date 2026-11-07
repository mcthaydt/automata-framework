// The narrative extension: the plugin and the six content kinds, after sectors (rooms) and puzzle
// (conditions, the `dialogue` and `verb` hooks).
import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
import { createNarrative, type Narrative } from '../../shared/sim/narrative.plugin'
import type { NarrativeOptions } from '../../shared/sim/narrative.system'
import {
  beatsContent,
  canonContent,
  dialogueContent,
  helpContent,
  linesContent,
  storyletsContent,
} from './narrative.content'

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
