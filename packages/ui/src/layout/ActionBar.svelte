<!--
  One row of actions (M1.6 spec §3.4; from FloorFifty `ui/layout/ActionBar.svelte` at 122a220).

  Gives way in a fixed order as its container narrows (`collapseLevel`): utilities to their icon,
  then secondaries to their short label, and only then a wrap with the primary on its own row.
  Three hidden, inert copies of the row ([data-measure]) report how wide it would be at each level,
  so the choice is measured rather than guessed from breakpoints.
-->
<script lang="ts">
import { type BarAction, type CollapseLevel, collapseLevel, measureBar } from './action-bar'
import { observeWidth } from './observe-size'

interface Props {
  actions: readonly BarAction[]
  testId?: string | undefined
  /** Injectable so a jsdom test can say what the browser would have measured. */
  measure?: (bar: HTMLElement) => { available: number; widths: [number, number, number] }
}

const { actions, testId, measure = measureBar }: Props = $props()

let bar = $state<HTMLElement | undefined>(undefined)
let level = $state<CollapseLevel>(0)

$effect(() => {
  const node = bar
  if (node === undefined) return
  void actions
  const decide = (): void => {
    const { available, widths } = measure(node)
    if (available > 0) level = collapseLevel(available, widths)
  }
  decide()
  // The widest measuring row too: a web font arriving widens the rows without resizing the bar.
  const widest = node.querySelector('[data-measure="0"]')
  const stops = [observeWidth(node, decide), ...(widest === null ? [] : [observeWidth(widest, decide)])]
  return () => {
    for (const stop of stops) stop()
  }
})

const classFor = (action: BarAction): string =>
  action.kind === 'primary'
    ? 'af-control af-control--primary af-action-bar__primary'
    : action.kind === 'secondary'
      ? 'af-control af-action-bar__secondary'
      : 'af-control af-control--ghost af-action-bar__utility'

const iconOnly = (action: BarAction, at: number): boolean =>
  action.kind === 'utility' && at >= 1 && action.icon !== undefined

const words = (action: BarAction, at: number): string =>
  action.kind === 'secondary' && at >= 2 ? (action.shortLabel ?? action.label) : action.label
</script>

<!-- No whitespace between icon and words: a button's text is its words alone. -->
{#snippet face(action: BarAction, at: number)}
  {#if action.icon}<span class="af-action-bar__icon" aria-hidden="true">{@render action.icon()}</span>{/if}{#if !iconOnly(action, at)}<span
      >{words(action, at)}</span
    >{/if}
{/snippet}

<div bind:this={bar} class="af-action-bar" data-action-bar data-collapse={level} data-testid={testId}>
  <div class="af-action-bar__row" data-row="visible">
    {#each actions as action (action.id)}
      <button
        type="button"
        class={classFor(action)}
        data-testid={action.testId ?? action.id}
        data-kind={action.kind}
        aria-label={iconOnly(action, level) || words(action, level) !== action.label ? action.label : undefined}
        aria-pressed={action.pressed}
        disabled={action.disabled}
        onclick={(event) => action.onSelect(event)}
      >
        {@render face(action, level)}
      </button>
    {/each}
  </div>
  <!-- The measuring rows, in a box that fills the bar and clips, so a row wider than the bar never
       widens a scroll container above it. -->
  <div class="af-action-bar__measures" data-measures aria-hidden="true" inert>
    {#each [0, 1, 2] as at (at)}
      <div class="af-action-bar__row af-action-bar__measure" data-measure={at}>
        {#each actions as action (action.id)}
          <span class={classFor(action)}>{@render face(action, at)}</span>
        {/each}
      </div>
    {/each}
  </div>
</div>

<style>
  /* `min-width: 0`, so as a grid or flex item it can be narrower than its unwrapped row and give way. */
  .af-action-bar {
    position: relative;
    min-width: 0;
  }

  .af-action-bar__row {
    display: flex;
    flex-wrap: nowrap;
    gap: 8px;
  }

  .af-action-bar__row > :global(.af-action-bar__primary),
  .af-action-bar__row > :global(.af-action-bar__secondary) {
    flex: 1 1 auto;
    white-space: nowrap;
  }

  .af-action-bar__row > :global(.af-action-bar__utility) {
    flex: none;
    white-space: nowrap;
  }

  /* Laid out, unwrapped and unflexed, but never seen. Their box is the bar's size and clips them;
     `scrollWidth` still reads each row's whole width. */
  .af-action-bar__measures {
    position: absolute;
    inset: 0;
    overflow: hidden;
    visibility: hidden;
    pointer-events: none;
  }

  .af-action-bar__measure {
    position: absolute;
    top: 0;
    left: 0;
    width: max-content;
  }

  .af-action-bar__measure > :global(*) {
    flex: none;
  }

  /* Level 2 also draws its buttons tighter, measured as drawn. */
  .af-action-bar[data-collapse="2"] [data-row="visible"],
  .af-action-bar__measure[data-measure="2"] {
    gap: 6px;
  }

  .af-action-bar[data-collapse="2"] [data-row="visible"] > :global(*),
  .af-action-bar__measure[data-measure="2"] > :global(*) {
    padding-inline: 10px;
  }

  /* The last resort: the primary alone on the first row, the rest under it. */
  .af-action-bar[data-collapse="3"] [data-row="visible"] {
    flex-wrap: wrap;
  }

  .af-action-bar[data-collapse="3"] [data-row="visible"] > :global(.af-action-bar__primary) {
    flex-basis: 100%;
  }
</style>
