<!--
  The level's top bar (plan ED3D.5c): Back, the level's file name over its path, the profile, then Undo, Redo and Save
  at the end. Undo and Redo are named with the step they act on and are disabled when there is none; Save and Back are
  disabled while a save or a dialog's choice runs. On a narrow screen the title and the path truncate and the buttons
  keep their size; on a phone the profile is left out. The heading takes the focus when the bar appears: the page
  changed. ED3D.5d adds the views (Plan, and the ones still coming, each saying why it cannot be chosen yet) and the
  checks pill. The views show at `wide` only; on a phone the pill is left to the status line, so the title keeps its room.
-->
<script lang="ts">
import { Button, Pill, Segmented } from '@automataframework/automata-editor/kit'
import { onMount } from 'svelte'
import { modeOptions, type PillTone } from '../../app/plan-status'
import type { ViewMode } from '../../model/view-store'

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
  mode: ViewMode
  /** Whether the views are offered: not on a phone, where the bar has no room. */
  views: boolean
  /** Below `wide`: Plan and 3D only (ED3D.5f). */
  narrow?: boolean | undefined
  /** The checks pill's words and tone (`checksWords`). */
  checks: { readonly text: string; readonly tone: PillTone }
  /** Whether the layers drawer is open, below `wide`; `undefined` where the panel is always in view (no button). */
  layersOpen?: boolean | undefined
  onlayers?: (() => void) | undefined
  onback: () => void
  onundo: () => void
  onredo: () => void
  onsave: () => void
  onmode: (mode: ViewMode) => void
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
  mode,
  views: showViews,
  narrow = false,
  checks,
  layersOpen,
  onlayers,
  onback,
  onundo,
  onredo,
  onsave,
  onmode,
}: Props = $props()

const views = $derived(modeOptions({ narrow }))
const chosen = (id: string): void => {
  const view = views.find((option) => option.id === id)
  if (view !== undefined) onmode(view.id)
}

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
  {#if layersOpen !== undefined}
    <Button aria-expanded={layersOpen} data-testid="toggle-layers" onclick={() => onlayers?.()}>Layers</Button>
  {/if}
  {#if showViews}
    <Segmented label="View" options={views} value={mode} onedit={(event) => chosen(event.value)} />
  {/if}
  {#if !compact}
    <span class="checks" data-testid="checks-pill"><Pill tone={checks.tone}>{checks.text}</Pill></span>
  {/if}
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
  .kind,
  .checks {
    flex: none;
  }
  .spacer {
    flex: 1;
  }
</style>
