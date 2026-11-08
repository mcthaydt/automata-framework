<!--
  The middle of the suite's top bar, between Home and the sheet toggles: the game's name, where edits are saved, the
  pills, then Undo, Redo, Ask, Play, Publish and the open editor's own tools. The pills and the tools scroll sideways when
  the bar is short of room. Only what has something to say is shown: no history hides Undo and Redo, no Ask hides
  Ask, nothing to publish hides Publish (12.7 Step G). Split out of `Suite.svelte` (12.7). Drawn as the document's
  bar is: the name in the title's weight, the saved note a quiet status with a tick, Undo and Redo icon buttons named
  with the step they take, and Publish the one lime button.
-->
<script lang="ts">
import type { Snippet } from 'svelte'
import Icon from '../../../shared/kit/icons/Icon.svelte'
import type { CheckFinding } from '../../../shared/kit/ports/suite-ports'
import Button from '../../../shared/kit/widgets/Button.svelte'
import IconButton from '../../../shared/kit/widgets/IconButton.svelte'
import Menu from '../../../shared/kit/widgets/Menu.svelte'
import type { Pill } from '../core/pills-model'
import SuitePills from './SuitePills.svelte'

interface Props {
  /** The game's name; `undefined` hides it (a phone, where Home and the tools need the room). */
  title: string | undefined
  /** Edits write the game's own files: say so once, as status. */
  saved: boolean
  pills: readonly Pill[]
  /** The pills as icons with counts, on a phone or a short screen. */
  compact: boolean
  onlocate: (finding: CheckFinding) => void
  /** The history Undo and Redo act on; `undefined` hides both. */
  history:
    | {
        readonly canUndo: boolean
        readonly canRedo: boolean
        readonly undoLabel: string
        readonly redoLabel: string
      }
    | undefined
  onundo: () => void
  onredo: () => void
  /** Opens Ask; `undefined` hides it. */
  onask: (() => void) | undefined
  /** The running game's page: Play opens it in a new tab; `undefined` hides Play (unless `playOff` says why). */
  playUrl: string | undefined
  /** Why the game cannot be played (it could not start): Play stays, off, and `onplayoff` says why. */
  playOff: string | undefined
  onplayoff: () => void
  /** A phone: Play and Publish share one Game menu that stays in view, instead of two buttons the bar has no room for. */
  gameMenu: boolean
  /** Publish is the game's own zip (not a change set's Publish): on a phone only that one moves into the Game menu. */
  publishIsGame: boolean
  /** Opens Publish; `undefined` hides it. */
  onpublish: (() => void) | undefined
  /** There is something to publish: Publish is the primary; otherwise it is quiet and its dialog says why. */
  shippable: boolean
  /** The open editor's own tools. */
  tools: Snippet | undefined
}

const {
  title,
  saved,
  pills,
  compact,
  onlocate,
  history,
  onundo,
  onredo,
  onask,
  playUrl,
  playOff,
  onplayoff,
  gameMenu,
  publishIsGame,
  onpublish,
  shippable,
  tools,
}: Props = $props()

const gameItems = $derived([
  ...(playUrl !== undefined || playOff !== undefined
    ? [
        // Not disabled when it is off: a press closes the menu and then says why (a disabled item would leave the menu
        // open over the explanation).
        { id: 'play', label: 'Play your game', detail: playUrl === undefined ? 'Off' : undefined },
      ]
    : []),
  ...(publishIsGame && onpublish !== undefined ? [{ id: 'publish', label: 'Make it ready to upload' }] : []),
])

function chooseGame(id: string): void {
  if (id === 'play') {
    if (playUrl === undefined) onplayoff()
    else window.open(playUrl, '_blank', 'noopener')
  } else if (id === 'publish') onpublish?.()
}
</script>

{#if title !== undefined}<span class="brand">{title}</span>{/if}
{#if saved}<span class="where"><Icon name="check" size={16} />Saved in your game folder</span>{/if}
<div class="tools" data-scroll-region="both">
  <SuitePills {pills} {compact} {onlocate} />
  <span class="spacer"></span>
  {#if history !== undefined}
    <IconButton
      icon="undo"
      label={history.canUndo ? `Undo ${history.undoLabel}` : 'Undo'}
      disabled={!history.canUndo}
      onclick={onundo}
    />
    <IconButton
      icon="redo"
      label={history.canRedo ? `Redo ${history.redoLabel}` : 'Redo'}
      disabled={!history.canRedo}
      onclick={onredo}
    />
  {/if}
  {#if onask !== undefined}<Button onclick={onask}>Ask</Button>{/if}
  {#if !gameMenu}
    {#if playUrl !== undefined}<a class="play" href={playUrl} target="_blank" rel="noreferrer">Play</a>
    {:else if playOff !== undefined}<Button aria-disabled="true" class="play-off" onclick={onplayoff}>Play</Button>{/if}
  {/if}
  {#if onpublish !== undefined && !(gameMenu && publishIsGame)}
    <Button variant={shippable ? 'primary' : 'plain'} onclick={onpublish}>Publish</Button>
  {/if}
  {@render tools?.()}
</div>
<!-- Outside the scrolling tools, so it is never cut off however narrow the bar is. -->
{#if gameMenu && gameItems.length > 0}
  <span class="game"><Menu label="Game" items={gameItems} presentation="sheet" onselect={chooseGame} /></span>
{/if}

<style>
  .brand {
    font: var(--text-title-15);
    margin-left: var(--space-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .where {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: var(--space-2);
    color: var(--muted);
    font: var(--text-body-13);
    white-space: nowrap;
  }
  /* Play is a link (it opens the game in a new tab), drawn as a plain button: a 44 px target with a hairline. */
  .play {
    display: inline-flex;
    align-items: center;
    min-height: var(--size-hit);
    padding: 0 var(--space-4);
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    background: var(--paper);
    color: var(--ink);
    font: var(--text-body-13-medium);
    text-decoration: none;
    white-space: nowrap;
  }
  .game {
    flex: none;
  }
  .spacer {
    flex: 1;
  }
  .tools {
    display: flex;
    flex: 1 1 auto;
    gap: var(--space-2);
    align-items: center;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  /* Play when the game could not start: drawn as a quiet, dimmed button that still answers a press with why. */
  .tools :global(.play-off) {
    color: var(--muted);
  }
  .tools > :global(*) {
    flex-shrink: 0;
  }
</style>
