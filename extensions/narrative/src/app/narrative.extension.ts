// The narrative extension: the plugin and the six content kinds, after whatever provides the places (sectors in 3D) and puzzle
// (conditions, the `dialogue` and `verb` hooks).
import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
import { sectorsPlaces } from '@automata/sectors/sim'
import { dialogueBoxSlot } from '../features/box/box-slot'
import {
  beatsContent,
  canonContent,
  dialogueContent,
  helpContent,
  linesContent,
  storyletsContent,
} from '../shared/narrative.content'
import type { LineRecord } from '../shared/sim/lines.schema'
import { createNarrative, type Narrative } from '../shared/sim/narrative.plugin'
import type { NarrativeOptions } from '../shared/sim/narrative.system'

export interface NarrativeExtension extends Narrative {
  readonly extension: ExtensionDef<'narrative'>
}

export interface NarrativeExtensionOptions extends NarrativeOptions {
  /** The game's message catalog (the one its screens use): the words for a line's locale key. With it, the dialogue box is drawn. */
  readonly words?: (key: string) => string | undefined
  /** The game's line records by id (its `lines` content): who speaks and the key of the words. */
  readonly lines?: (id: string) => LineRecord | undefined
}

export function narrativeExtension(options: NarrativeExtensionOptions = {}): NarrativeExtension {
  const narrative = createNarrative(options)
  return {
    ...narrative,
    extension: defineExtension({
      name: 'narrative',
      requires: [(options.places ?? sectorsPlaces).provider, 'puzzle'],
      sim: [narrative.plugin],
      ...(options.words === undefined
        ? {}
        : {
            ui: {
              slots: { 'hud.overlay': dialogueBoxSlot(options.words, options.lines ?? (() => undefined)) },
            },
          }),
      content: [canonContent, linesContent, dialogueContent, storyletsContent, beatsContent, helpContent],
    }),
  }
}
