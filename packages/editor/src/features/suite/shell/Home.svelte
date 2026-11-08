<!--
  Suite Home and an entry's page: the cards of the editors the game's
  list names (all of them on Home, the entry's on its page), or the list's problems. One vertical scroll region.
-->
<script lang="ts">
import type { Snippet } from 'svelte'
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
  /** For an editor with no file yet, the words on the button that starts one (the try-it sample's "New level"). */
  starts?: Readonly<Record<string, string>> | undefined
  /** What goes under the cards, inside the scrolling page (Home's Editor colours). */
  foot?: Snippet | undefined
}

const { title, home, editors, empty, onopen, onread, starts, foot }: Props = $props()

const cards = $derived(
  home.kind === 'cards'
    ? home.cards.filter((card) => editors === undefined || editors.includes(card.editor))
    : [],
)
</script>

<div class="scroll" data-testid="suite-home">
  <header>
    <h1>{title}</h1>
  </header>
  {#if home.kind === 'problems'}
    <ListProblems problems={home.problems} />
  {:else if cards.length === 0}
    <p class="note">{empty}</p>
  {:else}
    <div class="cards">
      {#each cards as card (card.editor)}
        <EditorCardView {card} {onopen} {onread} start={starts?.[card.editor]} />
      {/each}
    </div>
  {/if}
  {#if foot}<footer>{@render foot()}</footer>{/if}
</div>

<style>
  /* The shell's canvas takes every gesture; this region gives the vertical pan back, and nothing else. */
  .scroll {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    height: 100%;
    padding: var(--space-6) var(--space-5);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    touch-action: pan-y;
    background: var(--bg);
  }
  footer {
    width: 100%;
    max-width: 960px;
    margin-top: auto;
  }
  header {
    width: 100%;
    max-width: 960px;
  }
  h1 {
    margin: 0;
    font: var(--text-display-20);
  }
  .note {
    margin: 0;
    color: var(--muted);
  }
  .cards {
    max-width: 960px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
    gap: var(--space-4);
  }
</style>
