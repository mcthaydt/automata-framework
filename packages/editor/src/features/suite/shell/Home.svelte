<!--
  Suite Home and an entry's page (editor suite spec §5 flow 2, §9 `suite-home`): the cards of the editors the game's
  list names (all of them on Home, the entry's on its page), or the list's problems. One vertical scroll region.
-->
<script lang="ts">
import type { WorkspaceFile } from '../../../shared/kit/ports/suite-ports'
import EditorCardView from './EditorCardView.svelte'
import type { EditorCard, HomeState } from './home-model'
import ListProblems from './ListProblems.svelte'

interface Props {
  title: string
  home: HomeState
  /** Only these editors' cards; every card on Home. */
  editors?: readonly string[] | undefined
  /** Said when no card is left to show. */
  empty: string
  onopen: (card: EditorCard) => void
  onread: (file: WorkspaceFile) => void
}

const { title, home, editors, empty, onopen, onread }: Props = $props()

const cards = $derived(
  home.kind === 'cards'
    ? home.cards.filter((card) => editors === undefined || editors.includes(card.editor))
    : [],
)
</script>

<div class="scroll" data-testid="suite-home">
  <h1>{title}</h1>
  {#if home.kind === 'problems'}
    <ListProblems problems={home.problems} />
  {:else if cards.length === 0}
    <p class="note">{empty}</p>
  {:else}
    <div class="cards">
      {#each cards as card (card.editor)}
        <EditorCardView {card} {onopen} {onread} />
      {/each}
    </div>
  {/if}
</div>

<style>
  /* The shell's canvas takes every gesture; this region gives the vertical pan back, and nothing else. */
  .scroll {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    height: 100%;
    padding: var(--space-5);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    touch-action: pan-y;
    background: var(--color-bg-app);
  }
  h1 {
    margin: 0;
    font: var(--text-display-20);
  }
  .note {
    margin: 0;
    color: var(--color-text-dim);
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
    gap: var(--space-4);
  }
</style>
