// The cutscenes extension: the plugin and the `cutscene` content kind, after whatever provides the places (sectors in 3D),
// nav (nodes) and narrative (captions). The game wires `start` into puzzle's `cutscene` hook and `locked` into the input it
// wants held.
import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
import { cutsceneContent } from '../shared/cutscenes.content'
import { type Cutscenes, type CutscenesOptions, createCutscenes } from '../shared/sim/cutscene.plugin'

export interface CutscenesExtension extends Cutscenes {
  readonly extension: ExtensionDef<'cutscenes'>
}

export function cutscenesExtension(options: CutscenesOptions = {}): CutscenesExtension {
  const cutscenes = createCutscenes(options)
  return {
    ...cutscenes,
    extension: defineExtension({
      name: 'cutscenes',
      requires: [options.places?.provider ?? 'sectors', 'nav', 'narrative'],
      sim: [cutscenes.plugin],
      content: [cutsceneContent],
    }),
  }
}
