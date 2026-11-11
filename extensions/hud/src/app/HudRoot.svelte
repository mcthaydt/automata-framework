<!--
  @component
  The whole play HUD, in the play screen's `hud.overlay` slot: each piece of the `hud` file in the place it names, fed
  from the game's model, which is read again each frame. It decides nothing: a piece calls an action and the game turns it
  into a command. While a cutscene holds input every piece but the examine box is hidden, and while the examine box or the
  keypad is up the prompt steps aside so one press is never two. A word the game has no translation for is never shown as a
  key; it is told to whoever writes the game, once.
-->
<script lang="ts">
import { usePlay } from '@automata/framework'
import { untrack } from 'svelte'
import Examine from '../features/examine/Examine.svelte'
import Inventory from '../features/inventory/Inventory.svelte'
import Keypad from '../features/keypad/Keypad.svelte'
import { placeStyle } from '../features/layout/place'
import Objective from '../features/objective/Objective.svelte'
import Prompt from '../features/prompt/Prompt.svelte'
import type { HudOptions } from '../shared/hud-model'
import type { HudPiece } from '../shared/layout.schema'

const { options }: { options: HudOptions } = $props()
const play = usePlay()

// The model is read when the sim has stepped, not at every read of what it holds.
const tick = $derived(play.sim?.tick ?? -1)
const model = $derived.by(() => {
  void tick
  return untrack(() => options.model())
})

/** What a piece says when the file names no word for a slot: a word of the interface, never a key. */
const PLAIN = {
  hold: 'Hold',
  combine: 'Combine',
  close: 'Close',
  empty: 'Nothing carried.',
  delete: 'Delete',
  enter: 'Enter',
} as const

/** The words of `piece` for its slots: the file's key looked up, or the plain word when the file names none. */
function slots<S extends keyof typeof PLAIN>(piece: HudPiece, names: readonly S[]): Record<S, string> {
  const out = {} as Record<S, string>
  for (const name of names) {
    const key = piece.words?.[name]
    out[name] = (key === undefined ? undefined : options.words(key)) ?? PLAIN[name]
  }
  return out
}

/** The words for each key the model carries, by key; a key with none is absent. */
const said = $derived.by(() => {
  const keys = [
    model.objective,
    model.prompt?.name,
    model.examine?.title,
    model.examine?.line,
    ...model.items.flatMap((item) => [item.name, item.text]),
  ]
  const out: Record<string, string> = {}
  for (const key of keys) {
    const text = key === undefined ? undefined : options.words(key)
    if (key !== undefined && text !== undefined && text !== '') out[key] = text
  }
  return out
})

// A key is never shown: words that are missing are told to whoever writes the game, once each.
const told = new Set<string>()
$effect(() => {
  const wanted: [string, string | undefined][] = [
    ['objective', model.objective],
    ['hotspot name', model.prompt?.name],
    ['examine title', model.examine?.title],
    ['examine line', model.examine?.line],
    ...model.items.flatMap((item): [string, string][] => [
      ['item name', item.name],
      ['item text', item.text],
    ]),
  ]
  for (const [what, key] of wanted) {
    if (key === undefined || said[key] !== undefined || told.has(key)) continue
    told.add(key)
    globalThis.reportError?.(new Error(`The ${what} "${key}" has no words yet. Add them to the messages.`))
  }
})

const covered = $derived(model.examine !== undefined || model.keypad.open)
</script>

<div class="af-hud" data-testid="hud">
  {#each options.file.pieces as piece (piece.kind)}
    {@const style = placeStyle(piece.anchor, piece.width)}
    {#if piece.kind === 'examine'}
      {#if model.examine !== undefined && said[model.examine.line] !== undefined}
        <Examine
          title={model.examine.title === undefined ? undefined : said[model.examine.title]}
          line={said[model.examine.line] as string}
          close={slots(piece, ['close']).close}
          {style}
          ondismiss={() => options.actions.dismiss()}
        />
      {/if}
    {:else if !model.locked}
      {#if piece.kind === 'objective'}
        {#if model.objective !== undefined && said[model.objective] !== undefined}
          <Objective text={said[model.objective] as string} {style} />
        {/if}
      {:else if piece.kind === 'prompt'}
        {#if !covered && model.prompt !== undefined && said[model.prompt.name] !== undefined}
          {@const verb = piece.words?.label === undefined ? undefined : options.words(piece.words.label)}
          <Prompt
            name={said[model.prompt.name] as string}
            label={verb}
            {style}
            onuse={() => model.prompt !== undefined && options.actions.use(model.prompt.at)}
          />
        {/if}
      {:else if piece.kind === 'inventory'}
        <Inventory
          items={model.items.map((item) => ({
            id: item.id,
            name: said[item.name] ?? '',
            text: said[item.text] ?? '',
          }))}
          held={model.held}
          words={slots(piece, ['hold', 'combine', 'close', 'empty'])}
          {style}
          onhold={(item) => options.actions.hold(item)}
          oncombine={(a, b) => options.actions.combine(a, b)}
        />
      {:else if piece.kind === 'keypad'}
        {#if model.keypad.open}
          <Keypad
            digits={model.keypad.digits}
            words={slots(piece, ['delete', 'enter', 'close'])}
            {style}
            oncode={(code) => options.actions.code(code)}
            ondismiss={() => options.actions.dismiss()}
          />
        {/if}
      {/if}
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
