<!--
  The Characters view's stage in the editor suite's shell: the selected character drawn as it will stand in a level.
  The shell owns the panel and details toggles, so the stage has no pill. With no character selected it says what the
  settings every level has are.
-->
<script lang="ts">
import type { ObjectUrls } from '../../shared/level-2d/documents/view-props'
import { characterImages, charactersState } from './characters-state.svelte'
import DefinitionPreview from './DefinitionPreview.svelte'
import type { EntitiesSession } from './entities-session'

interface Props {
  session: EntitiesSession
  read: (path: string) => Promise<Uint8Array | undefined>
  objectUrls?: ObjectUrls | undefined
}

const { session, read, objectUrls }: Props = $props()

// svelte-ignore state_referenced_locally
const state = charactersState(session)
// svelte-ignore state_referenced_locally
const pictures = characterImages(() => state.project, read, objectUrls)
</script>

<div class="stage" data-scroll-region data-testid="entities-view">
  {#if state.selection.def === undefined}
    <div class="none" role="status">
      <h2>Settings every level has</h2>
      <p>
        Every level has these settings ({state.project.levels.length === 1
          ? '1 level'
          : `${state.project.levels.length} levels`}). To change them for one level, open it in the Level view and tap
        Details.
      </p>
    </div>
  {:else}
    <DefinitionPreview
      project={state.project}
      id={state.selection.def.id}
      images={pictures.images}
      imageUrl={pictures.imageUrl}
      room={{ w: 420, h: 300 }}
    />
  {/if}
</div>

<style>
  .stage {
    display: grid;
    align-content: start;
    gap: var(--space-4);
    height: 100%;
    padding: var(--space-3) var(--space-4) var(--space-5);
    overflow: auto;
    overscroll-behavior: contain;
    background: var(--bg);
  }
  .none {
    margin: 0;
    padding: var(--space-5);
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .none h2 {
    margin: 0 0 var(--space-2);
    color: var(--color-text-primary);
    font: var(--text-title-15);
  }
  .none p {
    margin: 0;
  }
</style>
