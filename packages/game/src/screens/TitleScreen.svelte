<!--
  The default title screen (DX spec §7): the game's title and one primary Play, on the ui frame.
  The flow focuses Play on entry (runtime flow step 7).
-->
<script lang="ts">
import { ActionBar, ScreenFrame } from '@mcthaydt/automata-ui'

interface Props {
  title: string
  onPlay: () => void
}

const { title, onPlay }: Props = $props()
</script>

{#snippet body()}
  <div class="af-game-menu__body">
    <h1 class="af-game-menu__title">{title}</h1>
  </div>
{/snippet}

{#snippet actions()}
  <ActionBar actions={[{ id: 'play', label: 'Play', kind: 'primary', onSelect: onPlay }]} />
{/snippet}

<div class="af-game-menu" data-game-screen="title">
  <ScreenFrame arrangement="stack" testId="title-screen" {body} {actions} />
</div>
