<!--
  base-3d’s end screen (DESIGN.md §13, End): over the run’s last frame, dimmed as paused dims play, the time and
  one primary Menu, focused on entry. There is no Play again: the menu drops the finished run’s sim, so its Play
  starts a fresh one (screens.ts).
-->
<script lang="ts">
import { ScreenFrame } from '@mcthaydt/automata-ui'
import CentredActions from './CentredActions.svelte'

interface Props {
  time: string
  onMenu: () => void
}

const { time, onMenu }: Props = $props()
</script>

{#snippet body()}
  <div class="af-game-menu__body">
    <h2 class="af-game-menu__title">The ember is yours</h2>
    <p data-slot="time">{time}</p>
  </div>
{/snippet}

{#snippet actions()}
  <CentredActions actions={[{ id: 'menu', label: 'Menu', kind: 'primary', onSelect: onMenu }]} />
{/snippet}

<div class="af-game-menu af-game-menu--scrim" data-game-screen="end">
  <ScreenFrame arrangement="stack" testId="end-screen" {body} {actions} />
</div>
