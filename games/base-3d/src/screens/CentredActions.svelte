<!--
  The game over's and the end screen's action row (GAME-3D.1b part 2): ui's ActionBar, centred at no more than 26rem,
  so on a wide screen the primary's focus ring sits in an equal margin on both sides rather than overhanging a
  full-width row's gutter on the left. On a phone held upright it takes the frame's whole width, as before.
-->
<script lang="ts">
import { ActionBar, type BarAction } from '@mcthaydt/automata-ui'

interface Props {
  actions: readonly BarAction[]
}

const { actions }: Props = $props()
</script>

<div class="base3d-actions">
  <ActionBar {actions} />
</div>

<style>
  .base3d-actions {
    width: min(100%, 26rem);
    min-width: 0;
    margin-inline: auto;
  }
</style>
