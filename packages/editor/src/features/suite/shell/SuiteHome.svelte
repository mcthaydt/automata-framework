<!--
  The suite's Home: on the sample, the note that this is not the person's game; Export and Import; then a card for
  each editor the game's list names, its files named in words. Split out of `Suite.svelte` (12.7).
-->
<script lang="ts">
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
  <div>
    {#if sample}
      <p class="banner" role="note">
        This is a sample game, not yours. Run automata editor inside your game's folder to edit it.
      </p>
    {/if}
    <div class="share">
      <Button onclick={() => oninterchange('export')}>Export</Button>
      <Button onclick={() => oninterchange('import')}>Import</Button>
    </div>
  </div>
  <Home title="What do you want to change?" {home} empty="This game has nothing to edit yet." {onopen} {onread} />
</div>

<style>
  .home {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    height: 100%;
  }
  .banner {
    margin: 0;
    padding: var(--space-3) var(--space-5);
    border-bottom: 1px solid var(--color-border-strong);
    background: var(--color-bg-app);
    font: var(--text-body-13);
  }
  .share {
    display: flex;
    gap: var(--space-2);
    justify-content: flex-end;
    padding: var(--space-3) var(--space-5) 0;
    background: var(--color-bg-app);
  }
</style>
