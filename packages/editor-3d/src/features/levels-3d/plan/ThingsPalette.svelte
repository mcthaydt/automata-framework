<!--
  The Things tool's palette (ED3D.7d, plan decision 1; ED3D spec §4.7): the level's entity definitions, each with its
  colour, the picked one pressed; a tap with the tool places the picked one. A definition whose layer is hidden or
  locked stays in view but cannot be picked, and says why.
-->
<script lang="ts">
import type { PaletteEntry } from '../things/things-tool-controller'

interface Props {
  palette: readonly PaletteEntry[]
  active: string | undefined
  onpick: (def: string) => void
}

const { palette, active, onpick }: Props = $props()
const uid = $props.id()

const reasonOf = (entry: PaletteEntry): string | undefined =>
  entry.hidden ? 'Its layer is hidden' : entry.locked ? 'Its layer is locked' : undefined
</script>

<div class="palette" role="group" aria-label="Things to place" data-testid="things-palette">
  {#each palette as entry (entry.def)}
    {@const reason = reasonOf(entry)}
    <button
      type="button"
      aria-pressed={entry.def === active}
      aria-disabled={reason !== undefined || undefined}
      aria-describedby={reason === undefined ? undefined : `${uid}-${entry.def}`}
      onclick={() => {
        if (reason === undefined) onpick(entry.def)
      }}
    >
      <span class="swatch" aria-hidden="true" style:background={entry.color ?? 'var(--color-text-dim)'}></span>
      {entry.label}
    </button>
    {#if reason !== undefined}<span class="reason" id={`${uid}-${entry.def}`}>{reason}</span>{/if}
  {/each}
</div>

<style>
  .palette {
    position: absolute;
    z-index: 1;
    top: var(--space-3);
    left: 50%;
    display: flex;
    gap: var(--space-1);
    max-width: calc(100% - 2 * var(--space-3));
    padding: var(--space-1);
    overflow-x: auto;
    transform: translateX(-50%);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background: var(--color-bg-surface);
  }
  button {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    padding: 0 var(--space-3);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-primary);
    font: var(--text-label-12);
    cursor: pointer;
  }
  button[aria-pressed='true'] {
    border-color: var(--color-accent-default);
    background: var(--color-bg-raised);
  }
  button[aria-disabled='true'] {
    opacity: 0.5;
  }
  .swatch {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }
  .reason {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
