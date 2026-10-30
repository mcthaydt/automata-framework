<!--
  The level's top bar (plan ED3D.5c): Back, the level's file name over its path, the profile, then Undo, Redo and Save
  at the end. Undo and Redo are named with the step they act on and are disabled when there is none; Save and Back are
  disabled while a save or a dialog's choice runs. On a narrow screen the title and the path truncate and the buttons
  keep their size; on a phone the profile is left out. The heading takes the focus when the bar appears: the page
  changed. The modes, the checks pill and the tools join it with the Plan view (ED3D.5d).
-->
<script lang="ts">
import { Button, Pill } from '@mcthaydt/automata-editor-kit'
import { onMount } from 'svelte'

interface Props {
  heading: { readonly title: string; readonly file: string }
  /** The id of the level's profile. */
  profile: string
  canUndo: boolean
  canRedo: boolean
  undoLabel: string | undefined
  redoLabel: string | undefined
  /** A save or a dialog's choice is running: Save, and Back (which would close the level under it), wait. */
  busy: boolean
  /** The shell is `compact` (a phone): the profile is left out so the title keeps its room. */
  compact: boolean
  onback: () => void
  onundo: () => void
  onredo: () => void
  onsave: () => void
}

const {
  heading,
  profile,
  canUndo,
  canRedo,
  undoLabel,
  redoLabel,
  busy,
  compact,
  onback,
  onundo,
  onredo,
  onsave,
}: Props = $props()

let title = $state<HTMLElement>()
onMount(() => title?.focus())
</script>

<div class="bar" data-testid="document-bar">
  <Button disabled={busy} onclick={onback}>Back</Button>
  <div class="titles">
    <h1 tabindex="-1" bind:this={title}>{heading.title}</h1>
    <span class="file">{heading.file}</span>
  </div>
  {#if !compact}<span class="kind"><Pill>{profile}</Pill></span>{/if}
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
