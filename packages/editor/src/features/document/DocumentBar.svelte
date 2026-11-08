<!--
  The document's top bar, essentials only, laid out as the approved mockup draws it: Back (an icon), the document's
  name and beside it, after a slash, where the view is (`place`: the Level view's level picker, a quiet menu), the
  views as quiet tabs, then on the right Problems and Share when they apply (`tools`), Undo and Redo as icon buttons,
  where the level stands on saving as a quiet status ("Saved" with a tick, "Not saved" with an amber dot, "Saving…",
  "Couldn't save" or "Not kept on this device" in the warning colour), and Save, the one primary button, which always
  says Save so its word never moves under a finger. The status is a live region only when saving went wrong or cannot
  happen here: a screen reader is not told "Not saved" after every brush stroke. The file's path and format are not here (the level's Details on Home has
  them); the bar carries the path as `data-path` for whoever needs it without reading it. Undo and Redo are named with
  the step they act on and are disabled when there is none; Save and Back wait while a save or a conflict choice runs.
  The name truncates on a narrow screen and the buttons keep their size. On a phone and an upright iPad the bar is two rows, so nothing
  shrinks below 44 px: Back, the name and Save on top; the switcher, the tools, Undo and Redo below. The heading takes
  focus when the bar appears: the page changed.
-->
<script lang="ts">
import { onMount, type Snippet } from 'svelte'
import Icon from '../../shared/kit/icons/Icon.svelte'
import type { SaveState } from '../../shared/kit/storage/save-state'
import Button from '../../shared/kit/widgets/Button.svelte'
import IconButton from '../../shared/kit/widgets/IconButton.svelte'

interface Props {
  heading: { readonly title: string; readonly file: string }
  /** Where the level stands on saving: the status beside Save says it. */
  save: SaveState
  canUndo: boolean
  canRedo: boolean
  undoLabel: string | undefined
  redoLabel: string | undefined
  /** Renames the level; without it the name is plain text. Tapping the name opens the rename dialog. */
  onrename?: (() => void) | undefined
  /** A phone or an upright iPad: the bar takes two rows. */
  compact?: boolean
  /** The view switcher. */
  switcher?: Snippet | undefined
  /** Where in the document the open view is, beside the name: the Level view's level picker. */
  place?: Snippet | undefined
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
  place,
  tools,
  autofocus = true,
  onfocused,
  onback,
  onundo,
  onredo,
  onsave,
}: Props = $props()

/** The status's words for each save state, in the words a person uses (no "dirty", no "OPFS"). */
const STATUS: Readonly<Record<SaveState, string>> = {
  saved: 'Saved',
  dirty: 'Not saved',
  saving: 'Saving…',
  error: 'Couldn’t save',
  device: 'Not kept on this device',
}
/** Only trouble is announced; the ordinary saved and not-saved flips would talk over every edit. */
const urgent = $derived(save === 'error' || save === 'device')

let title = $state<HTMLElement>()
onMount(() => {
  if (!autofocus) return
  title?.focus()
  onfocused?.()
})
</script>

<div class="bar" data-testid="document-bar" data-path={heading.file} data-compact={compact}>
  <span class="back"><IconButton icon="back" label="Back" disabled={busy} onclick={onback} /></span>
  <span class="title" data-place={place !== undefined}>
    <h1 tabindex="-1" bind:this={title}>
      {#if onrename}
        <button type="button" class="name" title="Rename" onclick={onrename}><span>{heading.title}</span></button>
      {:else}
        {heading.title}
      {/if}
    </h1>
    {#if place}<span class="sep" aria-hidden="true">/</span><span class="place">{@render place()}</span>{/if}
  </span>
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
    <span class="state" data-testid="save-state" data-save={save} aria-live={urgent ? 'polite' : 'off'}>
      {#if save === 'saved'}
        <Icon name="check" size={16} />
      {:else if urgent}
        <Icon name="alert" size={16} />
      {:else}
        <span class="dot" aria-hidden="true"></span>
      {/if}
      {STATUS[save]}
    </span>
    <Button variant="primary" disabled={busy} data-testid="save" onclick={onsave}>Save</Button>
  </span>
</div>

<style>
  /* Wide: one row, Back, the name and the views on the left, a gap that takes what is left, then the tools and
     Save; the name gives way first when the row is tight. Compact: Back, the name and Save on top, the rest below. */
  .bar {
    display: grid;
    flex: 1;
    grid-template-columns: auto minmax(0, max-content) auto minmax(0, 1fr) auto auto;
    grid-template-areas: 'back title switch . tools save';
    align-items: center;
    gap: var(--space-1);
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
    align-self: stretch;
    align-items: stretch;
    margin-left: var(--space-3);
    min-width: 0;
  }
  .bar[data-compact='true'] .switch {
    justify-content: flex-start;
    margin-left: 0;
  }
  .tools {
    grid-area: tools;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-1);
  }
  .save {
    grid-area: save;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  /* The save state: grey words with a mark before them, the mark coloured by what it says. */
  .state {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    padding: 0 var(--space-1);
    color: var(--muted);
    font: var(--text-body-13);
    white-space: nowrap;
  }
  .state[data-save='error'],
  .state[data-save='device'] {
    color: var(--color-state-warn);
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--muted);
  }
  .state[data-save='dirty'] .dot {
    background: var(--color-state-warn);
  }
  /* Both truncate when the bar is tight, the name first (down to a few letters, so it can still be tapped to rename),
     then the place beside it, so neither is ever covered by the switcher. */
  .title {
    grid-area: title;
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
  }
  .place {
    flex: 0 1 auto;
    min-width: 0;
  }
  /* The level menu reads as part of the path, not as a boxed button: no frame until the pointer is on it. */
  .place :global(.trigger) {
    max-width: 100%;
    overflow: hidden;
    padding: 0 var(--space-2);
    border-color: transparent;
    background: none;
    font: var(--text-title-15);
  }
  .place :global(.trigger:hover) {
    background: var(--surface);
  }
  /* With a place beside it, the document's name is the quiet start of the path. */
  .title[data-place='true'] h1 {
    color: var(--muted);
    font: var(--text-body-13);
  }
  .sep {
    color: var(--muted);
  }
  h1 {
    flex: 0 10 auto;
    min-width: 3rem;
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
    display: block;
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
  /* The words truncate inside their own box, so the button keeps its edge and its words never run past it. */
  .name span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .name:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
</style>
