<!--
  The suite's header, a breadcrumb: the open editor's icon and name, a slash, the open document with a chevron that opens
  its menu ("Levels / Start ▾"), the editor's views if it has any (Level, Tiles), then on the right Undo and Redo, the
  problem count, Saved, Play and Publish, the one lime button. Only what has something to say is shown: no history hides
  Undo and Redo, a folder that is not a game's hides Play and Publish, the sample hides Saved.
  Medium drops the editor's name and the first slash; under 900 px the problem count keeps its number and drops its word.
  Compact (a phone) has Home, a title that opens a sheet holding the views, the document's actions, the problems and Saved
  (so none is lost for want of room), then Undo, Redo, Play as an icon and Publish; every button stays whole at 44 px
  (Publish 48), and only the title gives way, by ellipsis. The editor's own tools sit between them, scrolling sideways when
  the bar is short of room, or on a row of their own under the buttons on a phone.
-->
<script lang="ts">
import type { Snippet } from 'svelte'
import Icon from '../../../shared/kit/icons/Icon.svelte'
import type { IconName } from '../../../shared/kit/icons/paths'
import type { EditorHeader } from '../../../shared/kit/ports/suite-editor'
import type { CheckFinding } from '../../../shared/kit/ports/suite-ports'
import Sheet from '../../../shared/kit/sheets/Sheet.svelte'
import type { ShellMode } from '../../../shared/kit/shell/shell-mode'
import Button from '../../../shared/kit/widgets/Button.svelte'
import IconButton from '../../../shared/kit/widgets/IconButton.svelte'
import Menu from '../../../shared/kit/widgets/Menu.svelte'
import Segmented from '../../../shared/kit/widgets/Segmented.svelte'
import type { Pill } from '../core/pills-model'
import ProblemCount from './ProblemCount.svelte'
import SaveState from './SaveState.svelte'

interface Props {
  mode: ShellMode
  /** The window is under 900 px wide: the problem count drops its word. */
  short: boolean
  /** The game's name: the phone's title on Home, where there is no editor to name. */
  game: string
  /** The open editor; `undefined` on Home. */
  editor: { readonly label: string; readonly icon: IconName } | undefined
  header: EditorHeader | undefined
  checks: Pill
  onlocate: (finding: CheckFinding) => void
  /** `undefined` hides it (the sample is not saved anywhere). */
  save: 'saved' | 'saving' | { readonly failed: string } | undefined
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
  /** Opens Publish (the game's own zip); `undefined` hides it. */
  onpublish: (() => void) | undefined
  /** Home, shown in compact where there is no sidebar. */
  onhome: () => void
  atHome: boolean
  /** The open editor's own tools. */
  tools: Snippet | undefined
}

const {
  mode,
  short,
  game,
  editor,
  header,
  checks,
  onlocate,
  save,
  history,
  onundo,
  onredo,
  playUrl,
  playOff,
  onplayoff,
  onpublish,
  onhome,
  atHome,
  tools,
}: Props = $props()

const compact = $derived(mode === 'compact')
const doc = $derived(header?.doc)
const views = $derived(header?.views)
const title = $derived(doc?.name ?? editor?.label ?? game)
let titleOpen = $state(false)

function chooseDocument(id: string): void {
  titleOpen = false
  doc?.onselect(id)
}
</script>

{#snippet viewTabs()}
  {#if views !== undefined}
    <Segmented
      label={views.label}
      look="tabs"
      options={views.options}
      value={views.value}
      onedit={(event) => views?.onchange(event.value)}
    />
  {/if}
{/snippet}

{#if compact}
  <IconButton icon="home" label="Home" aria-current={atHome ? 'page' : undefined} onclick={onhome} />
  <button type="button" class="title" aria-haspopup="dialog" aria-expanded={titleOpen} onclick={() => (titleOpen = true)}>
    <span class="name">{title}</span><Icon name="chevron-down" size={16} />
  </button>
{:else}
  <nav class="crumbs" aria-label="Where you are">
    {#if editor === undefined}
      <span class="here"><Icon name="home" size={18} />Home</span>
    {:else}
      {#if mode === 'wide' || doc === undefined}
        <span class="here"><Icon name={editor.icon} size={18} />{editor.label}</span>
      {/if}
      {#if doc !== undefined}
        {#if mode === 'wide'}<span class="slash" aria-hidden="true">/</span>{/if}
        <Menu
          label={doc.name}
          items={doc.items}
          onselect={(id) => doc?.onselect(id)}
        >
          {#snippet trigger()}<span class="doc">{doc?.name}</span><Icon name="chevron-down" size={16} />{/snippet}
        </Menu>
      {/if}
    {/if}
  </nav>
  {@render viewTabs()}
{/if}

{#if tools !== undefined}
  <div class="tools" data-compact={compact} data-scroll-region="both">{@render tools()}</div>
{/if}

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
{#if !compact}
  <ProblemCount pill={checks} {short} {onlocate} />
  {#if save !== undefined}<SaveState {save} />{/if}
{/if}
{#if playUrl !== undefined}
  <a class="play" href={playUrl} target="_blank" rel="noreferrer" aria-label="Play" data-compact={compact}>
    <Icon name="play" size={18} />{#if !compact}Play{/if}
  </a>
{:else if playOff !== undefined}
  <Button aria-disabled="true" class="play-off" onclick={onplayoff}>Play</Button>
{/if}
{#if onpublish !== undefined}<Button variant="primary" onclick={onpublish}>Publish</Button>{/if}

{#if compact}
  <Sheet open={titleOpen} label={title} onclose={() => (titleOpen = false)}>
    <div class="menu">
      {#if editor !== undefined}
        <p class="here"><Icon name={editor.icon} size={18} />{editor.label}</p>
      {/if}
      {#if doc !== undefined}
        <ul class="docs">
          {#each doc.items as item (item.id)}
            <li><button type="button" onclick={() => chooseDocument(item.id)}>{item.label}</button></li>
          {/each}
        </ul>
      {/if}
      {@render viewTabs()}
      <ProblemCount pill={checks} {onlocate} inline />
      {#if save !== undefined}<SaveState {save} />{/if}
    </div>
  </Sheet>
{/if}

<style>
  .crumbs {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
    margin-left: var(--space-1);
    font: var(--text-title-15);
  }
  .here {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--ink);
    white-space: nowrap;
  }
  .slash {
    color: var(--tool-faint);
  }
  .doc,
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .title {
    display: inline-flex;
    flex: 1 1 0;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
    min-height: var(--size-hit);
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--edge-sm);
    background: transparent;
    color: var(--ink);
    font: var(--text-title-15);
    cursor: pointer;
  }
  .title:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
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
  .tools > :global(*) {
    flex-shrink: 0;
  }
  /* A phone has no room beside Home, Undo, Redo, Play and Publish: the editor's own tools take the row under them. */
  .tools[data-compact='true'] {
    flex: 1 0 100%;
    order: 1;
    padding-bottom: var(--space-1);
  }
  /* Play is a link (it opens the game in a new tab), drawn as a plain button: a hit-size target with a hairline. */
  .play {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--size-hit);
    min-width: var(--size-hit);
    box-sizing: border-box;
    padding: 0 var(--space-4);
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    background: var(--raise);
    color: var(--ink);
    font: var(--text-body-13-medium);
    text-decoration: none;
    white-space: nowrap;
  }
  .play[data-compact='true'] {
    padding: 0;
  }
  /* Play when the game could not start: a quiet, dimmed button that still answers a press with why. */
  :global(.play-off) {
    color: var(--muted);
  }
  .menu {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4) var(--space-4);
  }
  .docs {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .docs button {
    width: 100%;
    min-height: var(--size-hit);
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--edge-sm);
    background: transparent;
    color: var(--ink);
    font: var(--text-body-13);
    text-align: left;
    cursor: pointer;
  }
</style>
