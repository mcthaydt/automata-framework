<!--
  The document's top bar, essentials only: Back, the level's name, the view switcher, Problems and Share when they
  apply (`tools`), Undo and Redo as icon buttons, and Save, the one
  primary button, which also says where the level stands: "Save" with changes to keep, "Saving…" while it writes,
  "Saved" when nothing is left to keep. The file's path and format are not here (the level's Details on Home has
  them); the bar carries the path as `data-path` for whoever needs it without reading it. Undo and Redo are named with
  the step they act on and are disabled when there is none; Save and Back wait while a save or a conflict choice runs.
  The name truncates on a narrow screen and the buttons keep their size. On a phone the bar is two rows, so nothing
  shrinks below 44 px: Back, the name and Save on top; the switcher, the tools, Undo and Redo below. The heading takes
  focus when the bar appears: the page changed.
-->
<script lang="ts">
import { onMount, type Snippet } from 'svelte'
import type { SaveState } from '../../shared/kit/storage/save-state'
import Button from '../../shared/kit/widgets/Button.svelte'
import IconButton from '../../shared/kit/widgets/IconButton.svelte'

interface Props {
  heading: { readonly title: string; readonly file: string }
  /** Where the level stands on saving: Save's own words come from it. */
  save: SaveState
  canUndo: boolean
  canRedo: boolean
  undoLabel: string | undefined
  redoLabel: string | undefined
  /** Renames the level; without it the name is plain text. Tapping the name opens the rename dialog. */
  onrename?: (() => void) | undefined
  /** A phone: the bar takes two rows. */
  compact?: boolean
  /** The view switcher. */
  switcher?: Snippet | undefined
  /** Problems and Share, where they apply. */
  tools?: Snippet | undefined
  /** A save or a conflict choice is running: Save, and Back (which would close the document under it), wait. */
  busy: boolean
  /** Focus the heading when the bar appears (the document opened); a bar remounted by a view change leaves focus alone. */
  autofocus?: boolean
  /** Told once the heading has taken focus. */
  onfocused?: (() => void) | undefined
  onback: () => void
  onundo: () => void
  onredo: () => void
  onsave: () => void
}

const {
  heading,
  save,
  canUndo,
  canRedo,
  undoLabel,
  redoLabel,
  busy,
  compact = false,
  onrename,
  switcher,
  tools,
  autofocus = true,
  onfocused,
  onback,
  onundo,
  onredo,
  onsave,
}: Props = $props()

/** Save's words: what pressing it would do, or that there is nothing left to do. */
const saveLabel = $derived(save === 'saving' ? 'Saving…' : save === 'saved' ? 'Saved' : 'Save')

let title = $state<HTMLElement>()
onMount(() => {
  if (!autofocus) return
  title?.focus()
  onfocused?.()
})
</script>

<div class="bar" data-testid="document-bar" data-path={heading.file} data-compact={compact}>
  <span class="back"><Button disabled={busy} onclick={onback}>Back</Button></span>
  <h1 tabindex="-1" bind:this={title}>
    {#if onrename}
      <button type="button" class="name" title="Rename" onclick={onrename}>{heading.title}</button>
    {:else}
      {heading.title}
    {/if}
  </h1>
  <span class="lower">
    <span class="switch">{@render switcher?.()}</span>
    <span class="tools">
      {@render tools?.()}
      <IconButton
        icon="undo"
        label={undoLabel === undefined ? 'Undo' : `Undo ${undoLabel}`}
        disabled={!canUndo}
        data-testid="undo"
        onclick={onundo}
      />
      <IconButton
        icon="redo"
        label={redoLabel === undefined ? 'Redo' : `Redo ${redoLabel}`}
        disabled={!canRedo}
        data-testid="redo"
        onclick={onredo}
      />
    </span>
  </span>
  <span class="save">
    <Button variant="primary" disabled={busy} data-testid="save" data-save={save} onclick={onsave}>{saveLabel}</Button>
  </span>
</div>

<style>
  /* Wide: one row, the name taking what is left. Compact: Back, the name and Save on top, the rest below. */
  .bar {
    display: grid;
    flex: 1;
    grid-template-columns: auto minmax(0, 1fr) auto auto auto;
    grid-template-areas: 'back title switch tools save';
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }
  .bar[data-compact='true'] {
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas:
      'back title save'
      'lower lower lower';
    padding: var(--space-1) 0;
  }
  .back {
    grid-area: back;
  }
  /* The switcher and the tools: grid cells of their own on one row, their own row of the bar on a phone, so a wide
     tools group never squeezes the name. */
  .lower {
    display: contents;
  }
  .bar[data-compact='true'] .lower {
    grid-area: lower;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    min-width: 0;
  }
  .switch {
    grid-area: switch;
    display: flex;
    justify-content: center;
    min-width: 0;
  }
  .bar[data-compact='true'] .switch {
    justify-content: flex-start;
  }
  .tools {
    grid-area: tools;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-2);
  }
  .save {
    grid-area: save;
  }
  h1 {
    grid-area: title;
    min-width: 0;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: var(--text-title-15);
  }
  h1:focus {
    outline: none;
  }
  /* The name looks like the heading it is; it is a button only so a tap can rename it. */
  .name {
    max-width: 100%;
    min-height: var(--size-hit);
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: text;
  }
  .name:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
</style>
