<!--
  @component
  The act card: the prologue's name over the opening's first shot, as the old game shows it (see `act-card.ts`). It reads the sim's
  cutscene clock when the sim has stepped, as the HUD does, and draws nothing outside its window. It is text, not a control: it takes
  no pointer and no focus, so a tap still reaches Skip, and it is announced once as a status.
-->
<script lang="ts">
import { CutsceneState } from '@automata/cutscenes/sim'
import { usePlay } from '@automata/framework'
import { untrack } from 'svelte'
import { ACT_CARD, cardAt } from './act-card.ts'
import { wordsOf } from './words.ts'

const play = usePlay()

// Read when the sim has stepped.
const tick = $derived(play.sim?.tick ?? -1)
const up = $derived.by(() => {
  void tick
  return untrack(() => {
    const sim = play.sim
    return sim !== undefined && cardAt(sim.resource(CutsceneState), sim.tick)
  })
})
const words = $derived(wordsOf(ACT_CARD.words))
</script>

{#if up && words !== undefined}
  <p class="act-card" role="status" data-testid="act-card">{words}</p>
{/if}

<style>
  .act-card {
    position: absolute;
    inset-inline: 0;
    top: 46%;
    margin: 0;
    text-align: center;
    pointer-events: none;
    /* The old card is cream pixel type, spaced wide, over the frame's middle; the pixel face is the framework's to give (a proposal). */
    font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
    font-weight: 700;
    font-size: clamp(1rem, 4.2vmin, 2.4rem);
    letter-spacing: 0.22em;
    color: #eadbc9;
    text-shadow: 0.08em 0.08em 0 #000;
    animation: act-card-in 0.8s steps(5, end) both;
  }
  @keyframes act-card-in {
    from {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .act-card {
      animation: none;
    }
  }
</style>
