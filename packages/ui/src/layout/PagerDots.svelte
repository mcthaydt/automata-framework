<!--
  Where a paged view is (M4 spec §4.8; from FloorFifty `ui/layout/PagerDots.svelte` at `ac72660`): one row of
  dots, each a whole touch target, or "3 / 11" once the dots would not fit on one row. It never wraps.
-->
<script lang="ts">
import { observeWidth } from './observe-size'
import { pagerMode } from './pager'

interface Props {
  count: number
  /** The current page, from 0. */
  index: number
  /** The group's name for assistive technology. */
  label: string
  /** The most dots shown before the counter takes over. */
  max?: number | undefined
  onselect?: ((index: number) => void) | undefined
  /** Each dot's name, from its 1-based position and the page count. */
  dotLabel?: ((position: number, total: number) => string) | undefined
  testId?: string | undefined
}

const {
  count,
  index,
  label,
  max = 9,
  onselect,
  dotLabel = (position: number, total: number) => `Page ${position} of ${total}`,
  testId,
}: Props = $props()

let root = $state<HTMLElement | undefined>(undefined)
let available = $state(Number.POSITIVE_INFINITY)
let dotSize = $state(44)
const mode = $derived(pagerMode(count, max, available, dotSize))

$effect(() => {
  if (root === undefined) return
  const measured = root
  return observeWidth(measured, (width) => {
    // A dot is one target wide, so it grows with the host's scale (Ruken's TV mode).
    const scale = Number.parseFloat(getComputedStyle(measured).getPropertyValue('--af-scale'))
    dotSize = 44 * (Number.isFinite(scale) && scale > 0 ? scale : 1)
    available = width
  })
})
</script>

<div bind:this={root} class="af-pager" role="group" aria-label={label} data-testid={testId}>
  {#if mode === 'dots'}
    <div class="af-pager__pill">
      {#each { length: count } as _, i (i)}
        <button
          type="button"
          class="af-pager__dot"
          data-pager-dot
          aria-label={dotLabel(i + 1, count)}
          aria-current={i === index ? 'true' : undefined}
          onclick={() => onselect?.(i)}
        >
          <span class="af-pager__pip" aria-hidden="true"></span>
        </button>
      {/each}
    </div>
  {:else}
    <span class="af-pager__pill af-pager__counter" data-testid="pager-counter" aria-live="polite"
      >{index + 1} / {count}</span
    >
  {/if}
</div>

<style>
  .af-pager {
    display: flex;
    justify-content: center;
    min-width: 0;
  }

  .af-pager__pill {
    display: inline-flex;
    align-items: center;
    border: var(--af-edge-width) solid var(--af-edge);
    border-radius: var(--af-radius);
    background: var(--af-panel);
  }

  .af-pager__dot {
    display: grid;
    place-items: center;
    width: var(--af-target);
    height: var(--af-target);
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    touch-action: manipulation;
  }

  .af-pager__dot:focus-visible {
    outline: var(--af-ring-width) solid var(--af-ring);
    outline-offset: -4px;
  }

  .af-pager__pip {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: var(--af-edge);
  }

  /* The current page is larger as well as brighter, so it does not rest on colour alone. */
  .af-pager__dot[aria-current='true'] .af-pager__pip {
    width: 14px;
    height: 14px;
    background: var(--af-accent);
  }

  .af-pager__counter {
    padding: 6px 14px;
    color: var(--af-ink);
    font: 600 var(--af-text-small) / 1.2 var(--af-font);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
