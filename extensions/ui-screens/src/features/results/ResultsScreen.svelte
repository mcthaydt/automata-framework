<!--
  @component
  The results screen: a title, the rows a game wants to show and one to three actions, on core's ScreenFrame.

  It never ranks. The caller passes the rows in the order to show them and the screen only shows them, so what decides the order
  (the sim, a server's standings) stays the one place that decides it. The rows are a declared scroll region; the actions
  are outside it, so a long list scrolls and the way out never moves. The primary action takes focus on entry (the first action
  when none is primary); Escape or the system back calls `onBack` when the game gives one.

  Edit freely once copied: the layout, the row markup and the order of the actions are yours. The geometry, the targets and the
  focus model are core's (`@automata/framework`), so keep using `ScreenFrame`, `ScrollList` and `ActionBar`.
-->
<script lang="ts">
import { ActionBar, ScreenFrame, ScrollList } from '@automata/framework'
import { onMount } from 'svelte'

/**
 * One line of the results list: a label and its value, with an optional detail line under it. `id`
 * keeps the row steady between updates.
 */
export interface ResultsRow {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly detail?: string | undefined
}
/**
 * A button on the results screen's action bar. Mark one `primary`; give each secondary a
 * `shortLabel` for when the bar is narrow.
 */
export interface ResultsAction {
  readonly id: string
  readonly label: string
  /** What a secondary action says when the bar is narrow ("Title" for "Back to title"); give one for each secondary. */
  readonly shortLabel?: string | undefined
  readonly primary?: boolean | undefined
}
/** The words this screen adds to the game's own: the rows' region name, the empty line and the "+N more" label. */
export interface ResultsCopy {
  readonly rows: string
  readonly empty: string
  readonly more: (count: number) => string
}

interface Props {
  title: string
  /** In the order to show them. */
  rows: readonly ResultsRow[]
  /** A row to mark as the player's own (`aria-current`). */
  highlight?: string | undefined
  actions: readonly ResultsAction[]
  copy: ResultsCopy
  onAction: (id: string) => void
  onBack?: (() => void) | undefined
}

const { title, rows, highlight, actions, copy, onAction, onBack }: Props = $props()

$effect.pre(() => {
  if (actions.length === 0)
    throw new Error('ResultsScreen needs at least one action: the player must have a way out')
})

let root = $state<HTMLElement | undefined>(undefined)
const bar = $derived(
  actions.map((action) => ({
    id: action.id,
    label: action.label,
    shortLabel: action.shortLabel,
    kind: action.primary === true ? ('primary' as const) : ('secondary' as const),
    onSelect: () => onAction(action.id),
  })),
)

onMount(() => {
  const first =
    root?.querySelector<HTMLElement>('[data-kind="primary"]') ?? root?.querySelector<HTMLElement>('button')
  first?.focus()
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && onBack !== undefined) onBack()
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
})
</script>

{#snippet body()}
  <div class="results__body">
    <h1 class="results__title">{title}</h1>
    {#if rows.length === 0}
      <p class="results__empty">{copy.empty}</p>
    {:else}
      <ScrollList minRows={3} rowCount={rows.length} label={copy.rows} moreLabel={copy.more} testId="results-rows">
        <ul class="results__rows">
          {#each rows as row (row.id)}
            <li class="results__row" data-row data-row-id={row.id} aria-current={row.id === highlight ? 'true' : undefined}>
              <span class="results__label">{row.label}</span>
              <span class="results__value">{row.value}</span>
              {#if row.detail !== undefined}<span class="results__detail">{row.detail}</span>{/if}
            </li>
          {/each}
        </ul>
      </ScrollList>
    {/if}
  </div>
{/snippet}

{#snippet footer()}
  <ActionBar actions={bar} />
{/snippet}

<div bind:this={root} class="results" data-game-screen="results">
  <ScreenFrame arrangement="stack" testId="results-screen" {body} actions={footer} />
</div>

<style>
  .results__body {
    display: grid;
    grid-template-rows: auto 1fr;
    gap: var(--af-gutter);
    min-height: 0;
    min-width: 0;
  }
  .results__title {
    margin: 0;
    font: 700 calc(24px * var(--af-scale, 1)) / 1.2 var(--af-font);
    text-align: center;
  }
  .results__empty {
    margin: 0;
    text-align: center;
  }
  .results__rows {
    display: grid;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .results__row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: baseline;
    column-gap: var(--af-gutter);
    min-height: var(--af-row-h);
    padding: 4px var(--af-gutter);
    border-radius: var(--af-radius);
    background: var(--af-surface);
  }
  .results__row[aria-current='true'] {
    outline: 2px solid var(--af-accent);
    outline-offset: -2px;
  }
  .results__detail {
    grid-column: 1 / -1;
    font-size: var(--af-text-small);
    opacity: 0.8;
  }
</style>
