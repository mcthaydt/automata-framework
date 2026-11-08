<!--
  The suite's Home: on the sample, the note that this is not the person's game; then the question and a card for each
  editor the game's list names, its files named in words. Split out of `Suite.svelte` (12.7).
-->
<script lang="ts">
import Icon from '../../../shared/kit/icons/Icon.svelte'
import type { WorkspaceFile } from '../../../shared/kit/ports/suite-ports'
import ThemeChoice from '../../../shared/kit/theme/ThemeChoice.svelte'
import Home from './Home.svelte'
import type { EditorCard, HomeState } from './home-model'

interface Props {
  home: HomeState
  /** The suite shows a sample, not the person's game (no server). */
  sample: boolean
  onopen: (card: EditorCard) => void
  onread: (file: WorkspaceFile) => void
}

const { home, sample, onopen, onread }: Props = $props()
</script>

<div class="home">
  {#if sample}
    <p class="banner" role="note">
      <Icon name="alert" size={16} />
      <span>This is a sample game, not yours. Run automata editor inside your game's folder to edit it.</span>
    </p>
  {/if}
  <Home
    title="What do you want to change?"
    lede={sample
      ? 'Pick a part of the sample to try.'
      : "Pick a part of your game. Everything you change is saved in your game's folder."}
    {home}
    empty="This game has nothing to edit yet."
    {onopen}
    {onread}
    starts={sample ? { 'levels-2d': 'New level' } : undefined}
  >
    {#snippet foot()}<ThemeChoice />{/snippet}
  </Home>
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
  .banner :global(svg) {
    margin-top: 1px;
    color: var(--color-state-warn);
  }
</style>
