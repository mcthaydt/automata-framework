<!--
  The middle of the suite's top bar, between Home and the sheet toggles: the game's name, where edits are saved, the
  pills, then Undo, Redo, Play, Publish and the open editor's own tools. The pills and the tools scroll sideways when the
  bar is short of room. Only what has something to say is shown: no history hides Undo and Redo, a folder that is not a
  game's hides Play and Publish. Split out of `Suite.svelte` (12.7). Drawn as the document's bar is: the name in the
  title's weight, the saved note a quiet status with a tick, Undo and Redo icon buttons named with the step they take,
  and Publish the one lime button. On a phone, Play and Publish share one Game menu.
-->
<script lang="ts">
import type { Snippet } from 'svelte'
import Icon from '../../../shared/kit/icons/Icon.svelte'
import type { CheckFinding } from '../../../shared/kit/ports/suite-ports'
import type { SaveLine } from '../../../shared/kit/storage/save-line'
import Button from '../../../shared/kit/widgets/Button.svelte'
import IconButton from '../../../shared/kit/widgets/IconButton.svelte'
import Menu from '../../../shared/kit/widgets/Menu.svelte'
import type { Pill } from '../core/pills-model'
import SuitePills from './SuitePills.svelte'

interface Props {
  /** The game's name, on a phone too: it is how a person knows which game this is. `undefined` hides it. */
  title: string | undefined
  /** Where the title goes when pressed (the person's list of games, on the web); the title is plain text without it. */
  titleHref?: string | undefined
  /** Where the work stands, in words, at every size: Saving…, Saved on this device, Not saved: … (`saveLine`). */
  line: SaveLine | undefined
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
  /** The running game's page: Play opens it in a new tab; `undefined` hides Play (unless `playOff` says why). */
  playUrl: string | undefined
  /** Why the game cannot be played (it could not start): Play stays, off, and `onplayoff` says why. */
  playOff: string | undefined
  onplayoff: () => void
  /** A phone: Play and Publish share one Game menu that stays in view, instead of two buttons the bar has no room for. */
  gameMenu: boolean
  /** Opens Publish (the game's own zip); `undefined` hides it. */
  onpublish: (() => void) | undefined
  /** The open editor's own tools. */
  tools: Snippet | undefined
  /** Files wait for the person's choice (changed here and on GitHub): the line is a button that asks again. */
  onchoose?: (() => void) | undefined
}

const {
  title,
  titleHref,
  line,
  pills,
  compact,
  onlocate,
  history,
  onundo,
  onredo,
  playUrl,
  playOff,
  onplayoff,
  gameMenu,
  onpublish,
  tools,
  onchoose,
}: Props = $props()

const gameItems = $derived([
  ...(playUrl !== undefined || playOff !== undefined
    ? [
        // Not disabled when it is off: a press closes the menu and then says why (a disabled item would leave the menu
        // open over the explanation).
        { id: 'play', label: 'Play your game', detail: playUrl === undefined ? 'Off' : undefined },
      ]
    : []),
  ...(onpublish !== undefined ? [{ id: 'publish', label: 'Make it ready to upload' }] : []),
])

function chooseGame(id: string): void {
  if (id === 'play') {
    if (playUrl === undefined) onplayoff()
    else window.open(playUrl, '_blank', 'noopener')
  } else if (id === 'publish') onpublish?.()
}
</script>

{#if title !== undefined}{#if titleHref !== undefined}<a class="brand home-link" href={titleHref} aria-label={`${title}: all your games`}>{title}</a>{:else}<span class="brand">{title}</span>{/if}{/if}
{#if line !== undefined}
  {#if onchoose !== undefined}
    <button class="where choose" type="button" data-state="failed" title={line.words} onclick={onchoose}>
      <Icon name="alert" size={16} /><span class="words">{line.words}</span>
    </button>
  {:else}
    <span class="where" data-state={line.state} role="status" title={line.words}>
      <Icon name={line.state === 'failed' ? 'alert' : 'check'} size={16} /><span class="words">{line.words}</span>
    </span>
  {/if}
{/if}
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
  {#if !gameMenu}
    {#if playUrl !== undefined}<a class="play" href={playUrl} target="_blank" rel="noreferrer">Play</a>
    {:else if playOff !== undefined}<Button aria-disabled="true" class="play-off" onclick={onplayoff}>Play</Button>{/if}
    {#if onpublish !== undefined}<Button variant="primary" onclick={onpublish}>Publish</Button>{/if}
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
  .home-link {
    display: inline-flex;
    align-items: center;
    min-height: var(--size-hit);
    color: inherit;
    text-decoration: none;
  }
  .home-link:hover {
    text-decoration: underline;
  }
  .home-link:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  .where {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: var(--space-2);
    color: var(--muted);
    font: var(--text-body-13);
    white-space: nowrap;
    /* The words say the work is safe, so they keep the room they need until the bar runs short: then they shorten with
       an ellipsis (the whole line is still the status and the title) rather than push Play, Publish or an editor's own
       tools off the screen. */
    flex: 0 1 auto;
    min-width: 5.5rem;
  }
  .where > :global(svg) {
    flex: none;
  }
  .words {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* The line as a button: it asks which file to keep, so it is a 44 px target in the warning colour. */
  .choose {
    min-height: var(--size-hit);
    padding: 0 var(--space-2);
    border: 0;
    background: none;
    cursor: pointer;
    text-decoration: underline;
  }
  .choose:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  .where[data-state='failed'] {
    color: var(--color-state-bad);
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
