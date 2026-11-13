<!--
  The default title screen: the game's title and one primary Play, on the ui frame.
  The flow focuses Play on entry (runtime flow step 7).
  A game with a save has no Play: the title lists the save's slots, and the chosen slot's primary action (New
  game, or Continue) takes Play's place, and its focus.
  On the desktop the title also offers Quit, after Play: there leaving the game is quitting the app, and the window's
  close box should not be the only way. Elsewhere the browser or the host owns leaving, so `onQuit` is not given.
-->
<script lang="ts">
import ActionBar from '../../shared/ui/layout/ActionBar.svelte'
import type { BarAction } from '../../shared/ui/layout/action-bar.ts'
import ScreenFrame from '../../shared/ui/layout/ScreenFrame.svelte'
import SaveSlots from './saves/SaveSlots.svelte'
import type { TitleSaves } from './saves/saves-title.ts'
import type { LiveScreensCopy } from './screens-copy.svelte.ts'

interface Props {
  title: string
  onPlay: () => void
  /** Quits the app: given only where the host can quit (the desktop). */
  onQuit?: (() => void) | undefined
  saves?: TitleSaves | undefined
  /** The screens' words in the player's language. */
  copy: LiveScreensCopy
}

const { title, onPlay, onQuit, saves, copy }: Props = $props()

const barActions = $derived<BarAction[]>([
  ...(saves === undefined
    ? [{ id: 'play', label: copy.current.title.play, kind: 'primary' as const, onSelect: onPlay }]
    : []),
  ...(onQuit === undefined
    ? []
    : [{ id: 'quit-app', label: copy.current.title.quit, kind: 'secondary' as const, onSelect: onQuit }]),
])
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
          copy={copy.current.saves.slots}
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
  <ActionBar actions={barActions} />
{/snippet}

<div class="af-game-menu" data-game-screen="title">
  {#if barActions.length > 0}
    <ScreenFrame arrangement="stack" testId="title-screen" {body} {actions} />
  {:else}
    <ScreenFrame arrangement="stack" testId="title-screen" {body} />
  {/if}
</div>
