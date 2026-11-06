<!--
  The document's top bar, essentials only: Back, the level's name, Undo and Redo as icon buttons, and Save, the one
  primary button, which also says where the level stands: "Save" with changes to keep, "Saving…" while it writes,
  "Saved" when nothing is left to keep. The file's path and format are not here (the level's Details on Home has
  them); the bar carries the path as `data-path` for whoever needs it without reading it. Undo and Redo are named with
  the step they act on and are disabled when there is none; Save and Back wait while a save or a conflict choice runs.
  The name truncates on a narrow screen and the buttons keep their size. The heading takes focus when the bar appears:
  the page changed.
-->
<script lang="ts">
import { onMount } from 'svelte'
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

<div class="bar" data-testid="document-bar" data-path={heading.file}>
  <Button disabled={busy} onclick={onback}>Back</Button>
  <h1 tabindex="-1" bind:this={title}>{heading.title}</h1>
  <span class="spacer"></span>
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
  <Button variant="primary" disabled={busy} data-testid="save" data-save={save} onclick={onsave}>{saveLabel}</Button>
</div>

<style>
  .bar {
    display: flex;
    flex: 1;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }
  h1 {
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
  .spacer {
    flex: 1;
  }
</style>
