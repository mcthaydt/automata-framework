<!--
  @component
  The cutscene's caption, in the play screen's `hud.overlay` slot: the words of the caption the playing cutscene has at
  this moment, centred above the dialogue box's place (the box tells the play field its height in
  `--af-dialogue-box-height`; with no box it is 0). It only reads the sim, takes no focus and lets taps through to
  the game. A caption whose line has no words shows nothing and is told to whoever writes the game, once.
-->
<script lang="ts">
import { usePlay } from '@automata/framework'
import { untrack } from 'svelte'
import { CutsceneState } from '../../shared/sim/cutscene.resource.ts'
import type { CutsceneScript } from '../../shared/sim/cutscene.schema.ts'
import { type CaptionLine, captionModel } from './caption.ts'

interface Props {
  /** The game's message catalog: the words for a locale key, or undefined when there are none. */
  words: (key: string) => string | undefined
  /** A line record by id (the game's `lines` content). */
  lines: (id: string) => CaptionLine | undefined
  /** The game's scripts by cutscene id. */
  scripts: Readonly<Record<string, CutsceneScript>>
  /** The sim's ticks a second. Default 60. */
  tickHz?: number
}

const { words, lines, scripts, tickHz = 60 }: Props = $props()
const play = usePlay()

// `tick` changes only when the sim steps, so the caption is read again then and not at every frame.
const tick = $derived(play.sim?.tick ?? -1)
const model = $derived.by(() => {
  void tick
  const sim = play.sim
  if (sim === undefined) return null
  return untrack(() => {
    const state = sim.resource(CutsceneState)
    const script = state.id === null ? undefined : scripts[state.id]
    if (script === undefined) return null
    return captionModel(script.caption, (sim.tick - state.start) / tickHz, lines, words)
  })
})

const told = new Set<string>()
$effect(() => {
  const missing = model?.missing
  if (missing === undefined || told.has(missing)) return
  told.add(missing)
  globalThis.reportError?.(new Error(`The caption "${missing}" has no words yet. Write them in Writer.`))
})
</script>

{#if model !== null && model.text !== ''}
  <p class="af-cutscene-caption" data-testid="cutscene-caption" aria-live="polite" style="pointer-events: none">{model.text}</p>
{/if}

<style>
  .af-cutscene-caption {
    position: absolute;
    left: 50%;
    bottom: calc(var(--af-dialogue-box-height, 0px) + 12px);
    transform: translateX(-50%);
    box-sizing: border-box;
    max-width: min(34rem, calc(100% - 24px));
    margin: 0;
    padding: 8px 14px;
    border-radius: 4px;
    background: rgb(0 0 0 / 0.72);
    color: #fff;
    font-size: 1.125rem;
    line-height: 1.35;
    text-align: center;
  }
</style>
