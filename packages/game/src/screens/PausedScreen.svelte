<!--
  The default paused screen (DX spec §7): Resume (primary, focused by the flow) and Quit to title,
  over a scrim so the paused game shows through.
-->
<script lang="ts">
import { ActionBar, ScreenFrame } from '@mcthaydt/automata-ui'

interface Props {
  onResume: () => void
  onQuit: () => void
}

const { onResume, onQuit }: Props = $props()
</script>

{#snippet body()}
  <div class="af-game-menu__body">
    <h2 class="af-game-menu__title">Paused</h2>
  </div>
{/snippet}

{#snippet actions()}
  <ActionBar
    actions={[
      { id: 'resume', label: 'Resume', kind: 'primary', onSelect: onResume },
      { id: 'quit', label: 'Quit to title', shortLabel: 'Quit', kind: 'secondary', onSelect: onQuit },
    ]}
  />
{/snippet}

<div class="af-game-menu af-game-menu--scrim" data-game-screen="paused">
  <ScreenFrame arrangement="stack" testId="paused-screen" {body} {actions} />
</div>
