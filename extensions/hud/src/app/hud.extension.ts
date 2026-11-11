// `hud` as an extension a game opts into: the play HUD in the `hud.overlay` slot and the `hud` content kind. A game using
// it passes no `words` to `narrativeExtension`, so one dialogue box draws, not two (the examine piece draws it).
import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
import { hudContent } from '../shared/hud.content'
import type { HudOptions } from '../shared/hud-model'
import { hudSlot } from './hud-slot'

/** The play HUD for a game's file, words, model and actions. */
export function hudExtension(options: HudOptions): ExtensionDef<'hud'> {
  return defineExtension({
    name: 'hud',
    requires: ['puzzle'],
    content: [hudContent],
    ui: { slots: { 'hud.overlay': hudSlot(options) } },
  })
}
