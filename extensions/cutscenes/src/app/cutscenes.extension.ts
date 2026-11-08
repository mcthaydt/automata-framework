// The cutscenes extension: the plugin and the `cutscene` content kind, after whatever provides the places (sectors in 3D),
// nav (nodes) and narrative (captions). The game wires `start` into puzzle's `cutscene` hook and `locked` into the input it
// wants held.
import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
import type { CaptionLine } from '../features/caption/caption'
import { captionSlot } from '../features/caption/caption-slot'
import { cutsceneContent } from '../shared/cutscenes.content'
import { type Cutscenes, type CutscenesOptions, createCutscenes } from '../shared/sim/cutscene.plugin'
import type { CutsceneScript } from '../shared/sim/cutscene.schema'

export interface CutscenesExtension extends Cutscenes {
  readonly extension: ExtensionDef<'cutscenes'>
}

export interface CutscenesExtensionOptions extends CutscenesOptions {
  /** The game's message catalog (the one its screens use): the words for a line's locale key. With it and `scripts`, captions are drawn. */
  readonly words?: (key: string) => string | undefined
  /** The game's line records by id (its `lines` content): the key of a caption's words. */
  readonly lines?: (id: string) => CaptionLine | undefined
  /** The game's scripts by cutscene id, so the caption can read what is up at this moment. */
  readonly scripts?: Readonly<Record<string, CutsceneScript>>
  /** The sim's ticks a second. Default 60. */
  readonly tickHz?: number
}

export function cutscenesExtension(options: CutscenesExtensionOptions = {}): CutscenesExtension {
  const cutscenes = createCutscenes(options)
  const { words, scripts } = options
  return {
    ...cutscenes,
    extension: defineExtension({
      name: 'cutscenes',
      requires: [options.places?.provider ?? 'sectors', 'nav', 'narrative'],
      sim: [cutscenes.plugin],
      ...(words === undefined || scripts === undefined
        ? {}
        : {
            ui: {
              slots: {
                'hud.overlay': captionSlot(
                  words,
                  options.lines ?? (() => undefined),
                  scripts,
                  options.tickHz,
                ),
              },
            },
          }),
      content: [cutsceneContent],
    }),
  }
}
