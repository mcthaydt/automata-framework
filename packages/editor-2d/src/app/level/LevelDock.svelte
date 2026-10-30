<!--
  The Level view's dock (plan ED2D.4c4b step 7, decision 4; 2D editor spec §8, the Level row): the world's levels as
  cards in the world's order, the open one marked. The shell places it: 148 px under the canvas in `wide`, a bottom
  sheet below it and on the short `wide` height, where the toolbar's Levels button opens it. The row scrolls sideways
  rather than shrinking a card under 44 px. Cards are keyed by level id, so the tapped card keeps focus.
-->
<script lang="ts">
import type { LevelCard } from './dock-model'

interface Props {
  cards: readonly LevelCard[]
  onopen: (id: string) => void
}

const { cards, onopen }: Props = $props()
</script>

<nav class="dock" aria-label="Levels" data-testid="level-dock" data-scroll-region="both">
  {#each cards as card (card.id)}
    <button
      type="button"
      class="card"
      aria-current={card.current ? 'true' : undefined}
      onclick={() => onopen(card.id)}
    >
      <span class="name">{card.name}</span>
      <span class="size">{card.size.w} × {card.size.h}</span>
    </button>
  {/each}
</nav>

<style>
  .dock {
    display: flex;
    gap: var(--space-2);
    box-sizing: border-box;
    height: 100%;
    padding: var(--space-2) var(--space-3);
    overflow-x: auto;
    overscroll-behavior-x: contain;
  }
  .card {
    display: grid;
    flex: 0 0 auto;
    align-content: center;
    gap: var(--space-1);
    min-width: 120px;
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background: var(--color-bg-raised);
    color: var(--color-text-primary);
    text-align: start;
    cursor: pointer;
  }
  .card[aria-current='true'] {
    border-color: var(--color-accent-default);
    background: var(--color-accent-soft);
  }
  .name {
    font: var(--text-body-13-medium);
  }
  .size {
    color: var(--color-text-dim);
    font: var(--text-mono-11);
  }
</style>
