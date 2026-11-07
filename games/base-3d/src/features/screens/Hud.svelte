<!--
  base-3d's HUD, in the play screen's `hud.overlay` slot: the ember count at the top inline-start, as Emberwick's. It reads
  the running sim every animation frame (`hudOf`) and takes no pointer.
-->
<script lang="ts">
import { onMount } from 'svelte'
import { liveCopy } from './copy.svelte.ts'
import { type HudState, hudInPlay, hudOf } from './hud.ts'

let state = $state<HudState | undefined>(hudOf(hudInPlay.sim))

onMount(() => {
  let frame = 0
  const read = (): void => {
    state = hudOf(hudInPlay.sim)
    frame = window.requestAnimationFrame(read)
  }
  frame = window.requestAnimationFrame(read)
  return () => window.cancelAnimationFrame(frame)
})
</script>

{#if state !== undefined}
  <div class="b3-hud" data-testid="hud">
    <div
      class="b3-hud__embers"
      data-testid="hud-embers"
      role="img"
      aria-label={liveCopy.current.hud.embers(state.embers, state.total)}
    >
      <span class="b3-hud__ember" aria-hidden="true"></span>{state.embers}
    </div>
  </div>
{/if}

<style>
  /* The play field's whole box: the frame's body, inside the visible region, above any touch row. */
  .b3-hud {
    position: relative;
    block-size: 100%;
    min-block-size: 0;
    pointer-events: none;
    color: var(--af-ink);
    font: var(--af-text-small);
    text-shadow: 0 1px 2px rgb(0 0 0 / 70%);
  }
  .b3-hud__embers {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-variant-numeric: tabular-nums;
  }
  .b3-hud__ember {
    inline-size: 12px;
    block-size: 12px;
    border-radius: 50%;
    background: #e37840;
  }
</style>
