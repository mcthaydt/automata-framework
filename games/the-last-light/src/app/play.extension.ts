import { content } from 'virtual:automata/content'
import { CutsceneState } from '@automata/cutscenes/sim'
import { usePlay } from '@automata/framework'
import { defineExtension, type ExtensionDef, type UiComponent } from '@automata/framework/extension'
import { type HudFile, hudSlot } from '@automata/hud'
import { hudContent } from '@automata/hud/content'
import { onDestroy } from 'svelte'
import type { PlayContent } from '../shared/play-content.ts'
import ActCard from './ActCard.svelte'
import { attachControls, firstPad } from './controls.ts'
import { bindLive, live } from './live.ts'
import PlayControls from './PlayControls.svelte'
import { hudActions, modelFor } from './presentation.ts'
import type { Runtime } from './runtime.ts'
import { wordsOf } from './words.ts'

/** The play HUD file as the content compiler read it (`content/hud/play.toml`). */
const hudFileOf = (): HudFile => {
  const file = (content as unknown as { hud?: Record<string, HudFile> }).hud?.play
  if (file === undefined) throw new Error('The game has no play HUD. Check content/hud/play.toml.')
  return file
}

/**
 * The play HUD: the objective, the prompt, the inventory, the examine box and the keypad, in the places and words of the
 * file `content/hud/play.toml`. It is the screen's way to the sim: it hands the game's read-only view and its way to send a
 * command to the rest of the screen (`live`) while it is up.
 */
/** The lamp and Skip buttons, in their own extension since an extension fills a slot once. */
export const playControls: ExtensionDef<'play-controls'> = defineExtension({
  name: 'play-controls',
  ui: { slots: { 'hud.overlay': PlayControls as unknown as UiComponent } },
})

/** The act card over the opening's first shot, in its own extension since an extension fills a slot once. */
export const actCard: ExtensionDef<'act-card'> = defineExtension({
  name: 'act-card',
  ui: { slots: { 'hud.overlay': ActCard as unknown as UiComponent } },
})

export function playHud(play: PlayContent, runtime: Runtime): ExtensionDef<'play-hud'> {
  const file = hudFileOf()
  const options = {
    file,
    words: wordsOf,
    model: () => modelFor(live, file, play, runtime),
    actions: hudActions(live, play),
  }
  const slot = ((anchor: unknown, props: unknown) => {
    const handle = usePlay()
    onDestroy(bindLive(handle.sim, (command) => handle.send(command)))
    // The lamp and skipping are not held keys: the screen sends each as one command.
    onDestroy(
      attachControls({
        target: window,
        send: (command) => handle.send(command),
        inCutscene: () => live.sim !== undefined && live.sim.resource(CutsceneState).id !== null,
        pad: firstPad,
      }),
    )
    return (hudSlot(options) as unknown as (a: unknown, p: unknown) => unknown)(anchor, props)
  }) as unknown as UiComponent
  return defineExtension({
    name: 'play-hud',
    requires: ['puzzle'],
    content: [hudContent],
    ui: { slots: { 'hud.overlay': slot } },
  })
}
