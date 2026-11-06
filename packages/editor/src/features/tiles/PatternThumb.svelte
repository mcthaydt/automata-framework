<!-- A rule's pattern as a 30 px thumbnail for its row: one square per cell, styled by its kind. -->
<script lang="ts">
import type { PatternCell } from '../../shared/level-2d/tiles/autotile/rule.schema'
import { kindOf } from './pattern-cell'

interface Props {
  size: 1 | 3 | 5
  pattern: readonly PatternCell[]
}

const { size, pattern }: Props = $props()
</script>

<span class="thumb" style:--size={size} aria-hidden="true">
  {#each pattern as cell, index (index)}
    <span class="cell" data-kind={kindOf(cell)}></span>
  {/each}
</span>

<style>
  .thumb {
    display: grid;
    grid-template-columns: repeat(var(--size), 1fr);
    gap: 1px;
    width: 30px;
    height: 30px;
    padding: 1px;
    border-radius: var(--radius-sm);
    background: var(--color-bg-canvas);
  }
  .cell {
    border-radius: 1px;
  }
  .cell[data-kind='any'] {
    background: transparent;
  }
  .cell[data-kind='empty'] {
    background: var(--color-bg-field);
    box-shadow: inset 0 0 0 1px var(--color-border-strong);
  }
  .cell[data-kind='filled'] {
    background: var(--color-text-dim);
  }
  .cell[data-kind='is'] {
    background: var(--color-accent-default);
  }
  .cell[data-kind='not'] {
    background: var(--color-state-bad);
  }
</style>
