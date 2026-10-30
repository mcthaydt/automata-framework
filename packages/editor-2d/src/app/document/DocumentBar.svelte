<!--
  The document's top bar (plan ED2D.4c2b, decision 8; mockup `level-platformer`): Back, the document's title over its
  path, the profile's label, then Undo, Redo and Save at the end. Undo and Redo are named with the step they act on and
  are disabled when there is none; Save and Back are disabled while a save or a conflict choice runs. On a narrow screen the title and the path
  truncate and the buttons keep their size; on a phone the profile's pill is left out. The heading takes focus when the bar appears: the page changed.
-->
<script lang="ts">
import { Button, Pill } from '@mcthaydt/automata-editor-kit'
import { onMount } from 'svelte'

interface Props {
  heading: { readonly title: string; readonly file: string }
  profileLabel: string
  canUndo: boolean
  canRedo: boolean
  undoLabel: string | undefined
  redoLabel: string | undefined
  /** A save or a conflict choice is running: Save, and Back (which would close the document under it), wait. */
  busy: boolean
  /** The shell is in `compact` mode (a phone): the profile's pill is left out so the title keeps its room. */
  compact: boolean
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
  profileLabel,
  canUndo,
  canRedo,
  undoLabel,
  redoLabel,
  busy,
  compact,
  autofocus = true,
  onfocused,
  onback,
  onundo,
  onredo,
  onsave,
}: Props = $props()

let title = $state<HTMLElement>()
onMount(() => {
  if (!autofocus) return
  title?.focus()
  onfocused?.()
})
</script>

<div class="bar" data-testid="document-bar">
  <Button disabled={busy} onclick={onback}>Back</Button>
  <div class="titles">
    <h1 tabindex="-1" bind:this={title}>{heading.title}</h1>
    <span class="file">{heading.file}</span>
  </div>
  {#if !compact}<span class="kind"><Pill>{profileLabel}</Pill></span>{/if}
  <span class="spacer"></span>
  <Button
    disabled={!canUndo}
    aria-label={undoLabel === undefined ? 'Undo' : `Undo ${undoLabel}`}
    data-testid="undo"
    onclick={onundo}>Undo</Button
  >
  <Button
    disabled={!canRedo}
    aria-label={redoLabel === undefined ? 'Redo' : `Redo ${redoLabel}`}
    data-testid="redo"
    onclick={onredo}>Redo</Button
  >
  <Button disabled={busy} data-testid="save" onclick={onsave}>Save</Button>
</div>

<style>
  .bar {
    display: flex;
    flex: 1;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }
  .titles {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  h1,
  .file {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  h1 {
    margin: 0;
    font: var(--text-title-15);
  }
  h1:focus {
    outline: none;
  }
  .file {
    color: var(--color-text-faint);
    font: var(--text-mono-11);
  }
  .kind {
    flex: none;
  }
  .spacer {
    flex: 1;
  }
</style>
