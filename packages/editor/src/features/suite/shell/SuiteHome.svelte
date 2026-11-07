<!--
  The suite's Home: on the sample, the note that this is not the person's game; then the question, with Export and
  Import beside it in the same row, and a card for each editor the game's list names, its files named in words. Split
  out of `Suite.svelte` (12.7).
-->
<script lang="ts">
import Icon from '../../../shared/kit/icons/Icon.svelte'
import type { WorkspaceFile } from '../../../shared/kit/ports/suite-ports'
import Button from '../../../shared/kit/widgets/Button.svelte'
import Home from './Home.svelte'
import type { EditorCard, HomeState } from './home-model'

interface Props {
  home: HomeState
  /** The suite shows a sample, not the person's game (no server). */
  sample: boolean
  onopen: (card: EditorCard) => void
  onread: (file: WorkspaceFile) => void
  oninterchange: (mode: 'export' | 'import') => void
}

const { home, sample, onopen, onread, oninterchange }: Props = $props()
</script>

<div class="home">
  {#if sample}
    <p class="banner" role="note">
      <Icon name="alert" size={16} />
      <span>This is a sample game, not yours. Run automata editor inside your game's folder to edit it.</span>
    </p>
  {/if}
  <Home title="What do you want to change?" {home} empty="This game has nothing to edit yet." {onopen} {onread}>
    {#snippet actions()}
      <Button title="Copy your game's settings as text, to keep or to share" onclick={() => oninterchange('export')}>Export changes</Button>
      <Button title="Bring in settings someone sent you as text" onclick={() => oninterchange('import')}>Import changes</Button>
    {/snippet}
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
