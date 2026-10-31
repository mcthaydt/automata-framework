<!--
  The pattern editor (plan ED2D.5b; 2D editor spec §5.6, §8 flow 6, §12: 44 px rule cells, every cell reachable from
  the keyboard). A tap cycles a cell any, empty, filled, is, not with the chosen IntGrid value; the cell being decided
  is marked. Each cell says what it holds in words, so the pattern is not colour alone.
-->
<script lang="ts">
import { kindOf } from './pattern-cell'
import type { PatternCellView } from './tilesets-model'

interface Props {
  size: 1 | 3 | 5
  cells: readonly PatternCellView[]
  oncycle: (index: number) => void
}

const { size, cells, oncycle }: Props = $props()

const short = { any: '', empty: '0', filled: '■', is: '=', not: '≠' } as const
</script>

<div class="pattern" role="group" aria-label="Pattern" style:--size={size} data-testid="pattern-editor">
  {#each cells as cell (cell.index)}
    {@const kind = kindOf(cell.cell)}
    <button
      type="button"
      class="cell"
      class:centre={cell.centre}
      data-kind={kind}
      aria-label={`Row ${Math.floor(cell.index / size) + 1}, column ${(cell.index % size) + 1}${cell.centre ? ' (centre)' : ''}: ${cell.label}`}
      onclick={() => oncycle(cell.index)}>{short[kind]}</button
    >
  {/each}
</div>

<style>
  .pattern {
    display: grid;
    grid-template-columns: repeat(var(--size), 44px);
    gap: var(--space-1);
    justify-content: center;
  }
  .cell {
    width: 44px;
    height: 44px;
    padding: 0;
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-primary);
    font: var(--text-title-15);
    cursor: pointer;
  }
  .cell:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: 2px;
  }
  .cell.centre {
    box-shadow: 0 0 0 2px var(--color-accent-default);
  }
  .cell[data-kind='empty'] {
    border-style: solid;
    background: var(--color-bg-field);
  }
  .cell[data-kind='filled'] {
    border-style: solid;
    background: var(--color-text-dim);
    color: var(--color-bg-app);
  }
  .cell[data-kind='is'] {
    border-style: solid;
    background: var(--color-accent-soft);
    color: var(--color-accent-default);
  }
  .cell[data-kind='not'] {
    border-style: solid;
    background: color-mix(in srgb, var(--color-state-bad) 18%, transparent);
    color: var(--color-state-bad);
  }
</style>
