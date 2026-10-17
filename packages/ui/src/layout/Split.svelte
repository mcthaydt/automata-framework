<!--
  Two panes side by side where both fit at `min` px, stacked otherwise (M4 spec §4.8; from FloorFifty
  `ui/layout/Split.svelte` at `ac72660`). Measured, because a container query cannot read a prop; stacked
  until the first measurement, so a pane never starts squeezed.
-->
<script lang="ts">
import type { Snippet } from 'svelte'
import { observeWidth } from './observe-size'
import { splitMode } from './split'

interface Props {
  /** The narrowest a pane may be, in px, before the two stack. */
  min: number
  gap?: number | undefined
  /** The columns when side by side, as `grid-template-columns`. */
  ratio?: string | undefined
  first: Snippet
  second: Snippet
}

const { min, gap = 16, ratio = '1fr 1fr', first, second }: Props = $props()

let root = $state<HTMLElement | undefined>(undefined)
let mode = $state<'row' | 'stack'>('stack')

$effect(() => {
  if (root === undefined) return
  return observeWidth(root, (width) => {
    mode = splitMode(width, min, gap)
  })
})
</script>

<div
  bind:this={root}
  class="af-split"
  data-split={mode}
  style:gap={`${gap}px`}
  style:grid-template-columns={mode === 'row' ? ratio : 'minmax(0, 1fr)'}
>
  <div class="af-split__pane">{@render first()}</div>
  <div class="af-split__pane">{@render second()}</div>
</div>

<style>
  .af-split {
    display: grid;
    min-width: 0;
    min-height: 0;
  }

  .af-split__pane {
    display: grid;
    min-width: 0;
    min-height: 0;
  }
</style>
