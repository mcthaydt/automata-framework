<!--
  The middle of the suite's top bar, between Home and the sheet toggles: the game's name, where edits are saved, the
  pills, then Undo, Redo and the open editor's own tools. The pills and the tools scroll sideways when the bar is short
  of room. Only what has something to say is shown: no history hides Undo and Redo (12.7 Step G). Split out of
  `Suite.svelte` (12.7). Drawn as the document's bar is: the name in the title's weight, the saved note a quiet status
  with a tick, and Undo and Redo icon buttons named with the step they take.
-->
<script lang="ts">
import type { Snippet } from 'svelte'
import Icon from '../../../shared/kit/icons/Icon.svelte'
import type { CheckFinding } from '../../../shared/kit/ports/suite-ports'
import IconButton from '../../../shared/kit/widgets/IconButton.svelte'
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
  /** The open editor's own tools. */
  tools: Snippet | undefined
}

const { title, saved, pills, compact, onlocate, history, onundo, onredo, tools }: Props = $props()
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
  {@render tools?.()}
</div>

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
  .tools > :global(*) {
    flex-shrink: 0;
  }
</style>
