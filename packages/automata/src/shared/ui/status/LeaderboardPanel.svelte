<!--
  @component
  A board's rows, or why there are none (M5 spec §7): loading, entries (the player's row marked "you"
  in words, not only by colour), empty, unavailable and offline. The rows are read, not chosen, so
  they are out of the focus order; only the action row (Back, Play again) takes focus. Unavailable
  and offline are what the host said: the panel never shows a board kept on the device instead.
  The rows sit in a ScrollList, a declared scroll region, so on a short screen they scroll and the
  action row stays.
-->
<script lang="ts">
import type { Snippet } from 'svelte'
import ScrollList from '../layout/ScrollList.svelte'
import type { LeaderboardCopy, LeaderboardView } from './leaderboard-panel'

interface Props {
  view: LeaderboardView
  copy: LeaderboardCopy
  /** How a score reads (a time, points). Default: the number as it is. */
  formatScore?: ((score: number) => string) | undefined
  /** The action row: the panel's only focusable part. */
  actions?: Snippet | undefined
  testId?: string | undefined
}

const { view, copy, formatScore = String, actions, testId = 'leaderboard' }: Props = $props()

const message = $derived(view.state === 'entries' ? undefined : copy[view.state])
</script>

<section class="af-leaderboard" data-leaderboard data-state={view.state} data-testid={testId} aria-label={copy.title}>
  <h2 class="af-leaderboard__title">{copy.title}</h2>
  {#if view.state === 'entries'}
    <div class="af-leaderboard__list">
    <ScrollList minRows={1} rowCount={view.entries.length} rowGap="4px" label={copy.title} moreLabel={copy.more}>
      <ol class="af-leaderboard__rows">
        {#each view.entries as entry (entry.rank)}
          <li class="af-leaderboard__row" data-row data-entry data-rank={entry.rank} data-me={entry.isMe ? '' : undefined}>
            <span class="af-leaderboard__rank">{entry.rank}</span>
            <span class="af-leaderboard__name">
              {entry.displayName}
              {#if entry.isMe}<span class="af-leaderboard__you">({copy.you})</span>{/if}
            </span>
            <span class="af-leaderboard__score">{formatScore(entry.score)}</span>
          </li>
        {/each}
      </ol>
    </ScrollList>
    </div>
  {:else}
    <p class="af-leaderboard__message" data-leaderboard-message role="status" aria-live="polite">{message}</p>
  {/if}
  {#if actions !== undefined}
    <div class="af-leaderboard__actions" data-leaderboard-actions>{@render actions()}</div>
  {/if}
</section>

<style>
  /* The panel fills what its parent gives it; the rows take what is left after the title and the action row, and
     scroll inside it, so the action row never goes below the fold (§8, 780×270 included). */
  .af-leaderboard {
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-sizing: border-box;
    height: 100%;
    min-height: 0;
    padding: 12px;
    border: var(--af-edge-width) solid var(--af-edge);
    border-radius: 8px;
    background: var(--af-panel);
    color: var(--af-ink);
    font: var(--af-text-body) / 1.3 var(--af-font);
  }

  .af-leaderboard__title {
    margin: 0;
    font: 700 var(--af-text-body) / 1.2 var(--af-font);
  }

  /* A 1fr grid row, as ScrollList asks of its parent: it keeps its reserved row and scrolls the rest. */
  .af-leaderboard__list {
    display: grid;
    flex: 1 1 auto;
    grid-template-rows: 1fr;
    min-height: 0;
  }

  .af-leaderboard__rows {
    display: grid;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .af-leaderboard__row {
    display: grid;
    grid-template-columns: 3ch 1fr auto;
    align-items: center;
    gap: 8px;
    min-height: var(--af-row-h);
    padding: 0 8px;
    border-radius: 4px;
  }

  .af-leaderboard__row[data-me] {
    outline: var(--af-edge-width) solid var(--af-accent);
    font-weight: 700;
  }

  .af-leaderboard__rank {
    text-align: end;
    font-variant-numeric: tabular-nums;
  }

  .af-leaderboard__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .af-leaderboard__score {
    font-variant-numeric: tabular-nums;
  }

  .af-leaderboard__message {
    margin: 0;
  }

  .af-leaderboard__actions {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
