<!--
  The menu's Settings: one secondary button in the screen's top corner, beside the save and not in it. The default
  title lists the save's slots and its actions (Continue or New game); Settings is the game's own, so it is here and the
  save's bar stays the framework's. It takes the frame's gutter and a 48 px target, and sits on the menu's layer.
-->
<script lang="ts">
import { liveCopy } from './copy.svelte.ts'

interface Props {
  onSettings: () => void
}

const { onSettings }: Props = $props()
</script>

<button type="button" class="af-control base3d-menu-settings" data-testid="menu-settings" onclick={onSettings}>
  {liveCopy.current.menu.settings}
</button>

<style>
  .base3d-menu-settings {
    position: absolute;
    inset-block-start: max(12px, env(safe-area-inset-top));
    inset-inline-end: max(12px, env(safe-area-inset-right));
    min-block-size: 48px;
  }
</style>
