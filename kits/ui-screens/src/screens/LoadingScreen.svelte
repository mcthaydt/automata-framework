<!--
  @component
  The loading screen (PRODUCT.6): the game's title on core's ScreenFrame with core's LoaderOverlay over it. The words are the game's
  own: `label` names the progress bar and `slowLabel` is what the overlay says once `slow` is set. Progress is 0 to 1, absent while
  unknown (the bar is then indeterminate). Edit the title, the art behind it, or swap the overlay: the frame is what keeps it inside
  the visible region.
-->
<script lang="ts">
import { LoaderOverlay, ScreenFrame } from '@mcthaydt/automata-ui'

interface Props {
  title: string
  label: string
  slowLabel: string
  /** 0 to 1; absent while unknown. */
  progress?: number | undefined
  slow?: boolean | undefined
}

const { title, label, slowLabel, progress, slow = false }: Props = $props()
</script>

{#snippet body()}
  <div class="loading__body">
    <h1 class="loading__title">{title}</h1>
  </div>
{/snippet}

<div class="loading" data-game-screen="loading">
  <ScreenFrame arrangement="stack" testId="loading-screen" {body} />
  <LoaderOverlay {label} {progress} {slow} {slowLabel} />
</div>

<style>
  .loading__body {
    display: grid;
    align-content: start;
    justify-items: center;
    min-width: 0;
  }
  .loading__title {
    margin: 0;
    font: 700 calc(24px * var(--af-scale, 1)) / 1.2 var(--af-font);
    text-align: center;
  }
</style>
