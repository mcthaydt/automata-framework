<!--
  @component
  The whole play HUD, in the play screen's `hud.overlay` slot: each piece of the `hud` file in the place it names, fed
  from the game's model, which is read again each frame. It decides nothing: a piece calls an action and the game turns it
  into a command. While a cutscene holds input every piece but the examine box is hidden. A word the game has no
  translation for is never shown as a key; it is told to whoever writes the game, once.
-->
<script lang="ts">
import { usePlay } from '@automata/framework'
import { untrack } from 'svelte'
import { placeStyle } from '../features/layout/place'
import Objective from '../features/objective/Objective.svelte'
import Prompt from '../features/prompt/Prompt.svelte'
import type { HudOptions } from '../shared/hud-model'

const { options }: { options: HudOptions } = $props()
const play = usePlay()

// The model is read when the sim has stepped, not at every read of what it holds.
const tick = $derived(play.sim?.tick ?? -1)
const model = $derived.by(() => {
  void tick
  return untrack(() => options.model())
})

const objective = $derived(model.objective === undefined ? undefined : options.words(model.objective))
const promptName = $derived(model.prompt === undefined ? undefined : options.words(model.prompt.name))
const verb = (words: Readonly<Record<string, string>> | undefined): string | undefined =>
  words?.label === undefined ? undefined : options.words(words.label)

// A key is never shown: words that are missing are told to whoever writes the game, once each.
const told = new Set<string>()
$effect(() => {
  const missing: [string, string | undefined, string][] = [
    ['objective', model.objective, objective ?? ''],
    ['hotspot name', model.prompt?.name, promptName ?? ''],
  ]
  for (const [what, key, text] of missing) {
    if (key === undefined || text !== '' || told.has(key)) continue
    told.add(key)
    globalThis.reportError?.(new Error(`The ${what} "${key}" has no words yet. Add them to the messages.`))
  }
})
</script>

<div class="af-hud" data-testid="hud">
  {#each options.file.pieces as piece (piece.kind)}
    {#if piece.kind === 'objective' && !model.locked && objective !== undefined && objective !== ''}
      <Objective text={objective} style={placeStyle(piece.anchor, piece.width)} />
    {:else if piece.kind === 'prompt' && !model.locked && model.prompt !== undefined && promptName !== undefined && promptName !== ''}
      <Prompt
        name={promptName}
        label={verb(piece.words)}
        style={placeStyle(piece.anchor, piece.width)}
        onuse={() => model.prompt !== undefined && options.actions.use(model.prompt.at)}
      />
    {/if}
  {/each}
</div>

<style>
  .af-hud {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
</style>
