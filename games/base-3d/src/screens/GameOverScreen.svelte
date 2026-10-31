<!--
  base-3d’s game over (DESIGN.md §7.8, §13): over the run’s last frame, dimmed as paused dims play, Continue (primary,
  focused on entry) plays on from the area entrance, and Quit goes to the menu.
-->
<script lang="ts">
import { ScreenFrame } from '@mcthaydt/automata-ui'
import CentredActions from './CentredActions.svelte'
import { liveCopy } from './copy.svelte.ts'

interface Props {
  onContinue: () => void
  onQuit: () => void
}

const { onContinue, onQuit }: Props = $props()
const words = $derived(liveCopy.current)
</script>

{#snippet body()}
  <div class="af-game-menu__body">
    <h2 class="af-game-menu__title">{words.gameOver.title}</h2>
  </div>
{/snippet}

{#snippet actions()}
  <CentredActions
    actions={[
      { id: 'continue', label: words.gameOver.continue, kind: 'primary', onSelect: onContinue },
      { id: 'quit', label: words.gameOver.quit, kind: 'secondary', onSelect: onQuit },
    ]}
  />
{/snippet}

<div class="af-game-menu af-game-menu--scrim" data-game-screen="game-over">
  <ScreenFrame arrangement="stack" testId="game-over-screen" {body} {actions} />
</div>
