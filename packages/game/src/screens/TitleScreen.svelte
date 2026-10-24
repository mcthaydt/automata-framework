<!--
  The default title screen (DX spec §7): the game's title and one primary Play, on the ui frame.
  The flow focuses Play on entry (runtime flow step 7).
  A game with a save (M5.2) has no Play: the title lists the save's slots, and the chosen slot's primary action (New
  game, or Continue) takes Play's place, and its focus.
-->
<script lang="ts">
import { ActionBar, SaveSlots, ScreenFrame } from '@mcthaydt/automata-ui'
import type { TitleSaves } from './saves-title.ts'

interface Props {
  title: string
  onPlay: () => void
  saves?: TitleSaves | undefined
}

const { title, onPlay, saves }: Props = $props()
</script>

{#snippet body()}
  {#if saves === undefined}
    <div class="af-game-menu__body">
      <h1 class="af-game-menu__title">{title}</h1>
    </div>
  {:else}
    <div class="af-game-menu__body af-game-menu__body--saves">
      <h1 class="af-game-menu__title">{title}</h1>
      <div class="af-game-menu__slots">
        <SaveSlots
          view={saves.model.view}
          copy={saves.copy}
          formatTime={saves.formatTime}
          onload={saves.onLoad}
          onnew={saves.onNew}
          ondelete={saves.onDelete}
        />
      </div>
    </div>
  {/if}
{/snippet}

{#snippet actions()}
  <ActionBar actions={[{ id: 'play', label: 'Play', kind: 'primary', onSelect: onPlay }]} />
{/snippet}

<div class="af-game-menu" data-game-screen="title">
  {#if saves === undefined}
    <ScreenFrame arrangement="stack" testId="title-screen" {body} {actions} />
  {:else}
    <ScreenFrame arrangement="stack" testId="title-screen" {body} />
  {/if}
</div>
