<!--
  A sound drawn: each tone a slanted bar and each hiss a band, standing at its pitch (high is up) across the part of the
  sound it lasts. It is only a picture to look at; every number is changed in the fields beside it. It follows the file, so
  it is always the sound as saved.
-->
<script lang="ts">
import type { Cue } from '@automata/audio-synth'
import { picture } from './audio-picture.ts'

const { cue }: { cue: Cue } = $props()

// The drawing is 600 by 96 and scales to the page's width; its height never passes 120 px.
const WIDTH = 600
const HEIGHT = 96
const bars = $derived(picture(cue, WIDTH, HEIGHT))
const TONE_HALF = 3
</script>

<svg
  class="picture"
  viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
  preserveAspectRatio="none"
  role="img"
  aria-label={`Shape of ${cue.id}: ${bars.length === 0 ? 'nothing to hear' : `${bars.length} ${bars.length === 1 ? 'part' : 'parts'}, left to right in time, higher up is higher pitched`}`}
>
  {#each bars as bar, index (index)}
    {#if bar.kind === 'tone'}
      <polygon
        data-bar
        class="tone"
        points={`${bar.x},${bar.y0 - TONE_HALF} ${bar.x + bar.w},${bar.y1 - TONE_HALF} ${bar.x + bar.w},${bar.y1 + TONE_HALF} ${bar.x},${bar.y0 + TONE_HALF}`}
      />
    {:else}
      <rect data-bar class="hiss" x={bar.x} y={bar.y0} width={bar.w} height={bar.y1 - bar.y0} />
    {/if}
  {/each}
</svg>

<style>
  .picture {
    display: block;
    box-sizing: border-box;
    width: 100%;
    height: 96px;
    max-height: 120px;
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
  }
  .tone {
    fill: var(--color-accent-default);
  }
  .hiss {
    fill: var(--color-accent-default);
    opacity: 0.35;
  }
</style>
