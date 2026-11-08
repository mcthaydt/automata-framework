<!--
  The middle of the suite's top bar, between Home and the sheet toggles: the game's name, where edits are saved, the
  pills, then Undo, Redo, Ask, Publish and the open editor's own tools. The pills and the tools scroll sideways when
  the bar is short of room. Only what has something to say is shown: no history hides Undo and Redo, no Ask hides
  Ask, nothing to publish hides Publish (12.7 Step G). Split out of `Suite.svelte` (12.7).
-->
<script lang="ts">
import type { Snippet } from 'svelte'
import type { CheckFinding } from '../../../shared/kit/ports/suite-ports'
import Button from '../../../shared/kit/widgets/Button.svelte'
import type { Pill } from '../core/pills-model'
import SuitePills from './SuitePills.svelte'

interface Props {
  /** The game's name; `undefined` hides it (a phone, where Home and the tools need the room). */
  title: string | undefined
  /** Edits write the game's own files: say so once, as status. */
  saved: boolean
  pills: readonly Pill[]
  /** Icons and arrows in place of words, on a phone or a short screen. */
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
  /** Opens Publish; `undefined` hides it. */
  onpublish: (() => void) | undefined
  /** The open editor's own tools. */
  tools: Snippet | undefined
}

const { title, saved, pills, compact, onlocate, history, onundo, onredo, onask, onpublish, tools }: Props =
  $props()
</script>

{#if title !== undefined}<span class="brand">{title}</span>{/if}
{#if saved}<span class="where">Saved in your game folder</span>{/if}
<div class="tools" data-scroll-region="both">
  <SuitePills {pills} {compact} {onlocate} />
  <span class="spacer"></span>
  {#if history !== undefined}
    <!-- Named in words where there is room; the arrows alone on a phone, where the full name is the label. -->
    <Button disabled={!history.canUndo} aria-label={history.canUndo ? `Undo ${history.undoLabel}` : 'Undo'} onclick={onundo}
      >{compact ? '↶' : 'Undo'}</Button
    >
    <Button disabled={!history.canRedo} aria-label={history.canRedo ? `Redo ${history.redoLabel}` : 'Redo'} onclick={onredo}
      >{compact ? '↷' : 'Redo'}</Button
    >
  {/if}
  {#if onask !== undefined}<Button onclick={onask}>Ask</Button>{/if}
  {#if onpublish !== undefined}<Button variant="primary" onclick={onpublish}>Publish</Button>{/if}
  {@render tools?.()}
</div>

<style>
  .brand {
    font: var(--text-title-15);
  }
  .where {
    color: var(--color-text-dim);
    font: var(--text-eyebrow-11);
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
