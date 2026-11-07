// The cutscenes extension (M6 spec §4.8): the plugin and the `cutscene` content kind, after sectors (anchors and the map),
// nav (nodes) and narrative (captions). The game wires `start` into puzzle's `cutscene` hook and `locked` into the input it
// wants held.
import { defineExtension, type ExtensionDef } from '@mcthaydt/automata-runtime/extension'
import { cutsceneContent } from './cutscenes.content'
import { type Cutscenes, type CutscenesOptions, createCutscenes } from './sim/cutscene.plugin'

export interface CutscenesExtension extends Cutscenes {
  readonly extension: ExtensionDef<'cutscenes'>
}

export function cutscenesExtension(options: CutscenesOptions = {}): CutscenesExtension {
  const cutscenes = createCutscenes(options)
  return {
    ...cutscenes,
    extension: defineExtension({
      name: 'cutscenes',
      requires: ['sectors', 'nav', 'narrative'],
      sim: [cutscenes.plugin],
      content: [cutsceneContent],
    }),
  }
}
