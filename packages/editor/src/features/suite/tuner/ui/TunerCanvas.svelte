<!--
  The Tuner's canvas, a split view: the game running on one side and the settings on the other, so each change shows
  in the game as it lands (the Owner, 2026-11-06). Side by side when the canvas is at least 480 px wide (an iPad
  held sideways or upright, a phone held sideways), stacked with the game on top when it is narrower (a phone upright,
  a small window whose panels take the width). The canvas's own width decides, not the window's: the shell's
  panels and inspector take a different share at each size, and a phone held sideways is too short to stack.
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
    grid-template-rows: minmax(180px, 40%) minmax(0, 1fr);
    height: 100%;
    min-height: 0;
  }
  @container tuner-canvas (min-width: 480px) {
    .split {
      grid-template-rows: minmax(0, 1fr);
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }
</style>
