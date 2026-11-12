<!--
  @component
  The two controls a finger needs that the HUD does not draw: the lamp (once Ada holds it) and Skip (while a cutscene plays).
  Each is a button of at least 48 px that sends one command; the keyboard and the pad do the same through `controls.ts`, so the
  buttons are drawn only while the player is touching (input mode, which is separate from the layout: the container's size
  moves them, never whether they are there).
  The lamp sits bottom-left and Skip bottom-right, where the HUD's own pieces are hidden by the cutscene.
-->
<script lang="ts">
import { CutsceneSkip, CutsceneState } from '@automata/cutscenes/sim'
import { usePlay } from '@automata/framework'
import { PuzzleState } from '@automata/puzzle/sim'
import { CarriedLight, ToggleLight } from '@automata/systems/sim'
import { untrack } from 'svelte'
import { wordsOf } from './words.ts'

const play = usePlay()

// Read when the sim has stepped, as the HUD is.
const tick = $derived(play.sim?.tick ?? -1)
const view = $derived.by(() => {
  void tick
  return untrack(() => {
    const sim = play.sim
    if (sim === undefined) return { cutscene: false, lamp: false, lit: false }
    const [light] = sim.query(CarriedLight)
    return {
      cutscene: sim.resource(CutsceneState).id !== null,
      lamp: sim.resource(PuzzleState).items.includes('handLamp'),
      lit: light === undefined ? false : light.get(CarriedLight).lit,
    }
  })
})

const send = (type: string): void => play.send({ type, payload: {} })
</script>

{#if play.inputMethod !== 'touch'}
  <!-- A keyboard or a pad has F, X (held) and the pad's buttons; a button over their frame is clutter. -->
{:else if view.cutscene}
  <button
    type="button"
    class="af-control af-control--primary play-skip"
    data-testid="play-skip"
    onclick={() => send(CutsceneSkip.id)}
  >{wordsOf('controls.skip') ?? 'Skip'}</button>
{:else if view.lamp}
  <button
    type="button"
    class="af-control af-control--primary play-lamp"
    data-testid="play-lamp"
    aria-pressed={view.lit}
    onclick={() => send(ToggleLight.id)}
  >{wordsOf('controls.lamp') ?? 'Lamp'}</button>
{/if}

<style>
  .play-skip,
  .play-lamp {
    position: absolute;
    bottom: var(--af-gutter, 16px);
    box-sizing: border-box;
    min-width: var(--af-target-primary, 48px);
    min-height: var(--af-target-primary, 48px);
    padding-inline: 16px;
    pointer-events: auto;
  }
  .play-skip {
    right: var(--af-gutter, 16px);
  }
  .play-lamp {
    left: var(--af-gutter, 16px);
  }
</style>
