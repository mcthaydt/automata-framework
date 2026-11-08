<!--
  The suite's Home: on the sample, the note that this is not the person's game; then the question and a card for each
  editor the game's list names, its files named in words. Split out of `Suite.svelte` (12.7).
-->
<script lang="ts">
import Icon from '../../../shared/kit/icons/Icon.svelte'
import type { WorkspaceFile } from '../../../shared/kit/ports/suite-ports'
import Home from './Home.svelte'
import type { EditorCard, HomeState } from './home-model'

interface Props {
  home: HomeState
  /** The suite shows a sample, not the person's game (no server). */
  sample: boolean
  /** The sample is kept in this browser; when it is not, the banner says what is made here is lost with the page. */
  kept: boolean
  onopen: (card: EditorCard) => void
  onread: (file: WorkspaceFile) => void
}

const { home, sample, kept, onopen, onread }: Props = $props()
</script>

<div class="home">
  {#if sample}
    <p class="banner" role="note">
      <Icon name="alert" size={16} />
      <span class="words">
        A sample game to try. Make your own with one command.
        <code>npx @automata/tools create-game my-game</code>
        {#if !kept}<span>Your changes are lost when you close this page.</span>{/if}
      </span>
    </p>
  {/if}
  <Home
    title="What do you want to change?"
    {home}
    empty="This game has nothing to edit yet."
    {onopen}
    {onread}
    starts={sample ? { 'levels-2d': 'New level' } : undefined}
  />
</div>

<style>
  .home {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    height: 100%;
    background: var(--bg);
  }
  /* One quiet line across the page, in the warning colour's ink only for its mark: it informs, it is not an error. */
  .banner {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    margin: 0;
    padding: var(--space-3) var(--space-5);
    border-bottom: 1px solid var(--line);
    background: var(--paper);
    font: var(--text-body-13);
  }
  /* The command sits on its own line so it can be selected whole and does not wrap through the middle on a phone. */
  .words {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
  }
  .words code {
    justify-self: start;
    max-width: 100%;
    overflow-wrap: anywhere;
    padding: 2px var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--edge-sm);
    background: var(--bg);
    font: var(--text-mono-12);
    user-select: all;
  }
  .banner :global(svg) {
    margin-top: 1px;
    color: var(--color-state-warn);
  }
</style>
