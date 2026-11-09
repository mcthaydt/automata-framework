<!--
  The Tuner's canvas, a split view: the game running on one side and the settings on the other, so each change shows
  in the game as it lands (the Owner, 2026-11-06). Side by side when the canvas is at least 560 px wide (an iPad
  held either way, a phone held sideways), with the game the larger pane; stacked with the game on top when it is
  narrower (a phone upright). The canvas's own width decides, not the window's, and the Tuner has no panel or
  inspector to take a share of it.
-->
<script lang="ts">
import type { TunerSuiteSession } from '../tuner-suite-editor'
import TunerGame from './TunerGame.svelte'
import TunerRows from './TunerRows.svelte'

const { session }: { session: TunerSuiteSession } = $props()
</script>

<div class="canvas">
  <div class="split" data-testid="tuner-split">
    <TunerGame url={session.gameUrl} />
    <TunerRows controller={session.controller} />
  </div>
</div>

<style>
  .canvas {
    container: tuner-canvas / inline-size;
    height: 100%;
    min-height: 0;
  }
  .split {
    display: grid;
    /* Stacked: the game takes the top, never so little that it cannot be played; the settings scroll below. */
    grid-template-rows: minmax(200px, 45%) minmax(0, 1fr);
    height: 100%;
    min-height: 0;
  }
  /* Side by side the game is the larger pane: it takes what the settings column leaves, and the settings keep a
     column wide enough for a slider and its read-out. */
  @container tuner-canvas (min-width: 560px) {
    .split {
      grid-template-rows: minmax(0, 1fr);
      grid-template-columns: minmax(0, 1fr) clamp(300px, 36%, 420px);
    }
  }
</style>
