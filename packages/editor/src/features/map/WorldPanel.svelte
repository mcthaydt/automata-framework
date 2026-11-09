<!--
  The Map view's panel: which world (when there is more than one), how its levels are arranged, and its levels as a
  list to choose from, with Add level. It edits nothing itself: the view applies each step (split from `WorldView`
  in 12.5).
-->
<script lang="ts">
import Button from '../../shared/kit/widgets/Button.svelte'
import Segmented from '../../shared/kit/widgets/Segmented.svelte'
import type { Level, Project, World, WorldLayout } from '../../shared/level-2d/model/project-types'

interface Props {
  project: Project | undefined
  worldId: string
  world: World | undefined
  levels: readonly Level[]
  selected: string | undefined
  /** Adds a level; `undefined` hides Add level. */
  onadd: (() => void) | undefined
  onlayout: (layout: WorldLayout) => void
}

let {
  project,
  worldId = $bindable(),
  world,
  levels,
  selected = $bindable(),
  onadd,
  onlayout,
}: Props = $props()

const LAYOUTS: readonly { id: WorldLayout; label: string }[] = [
  // Plain words for each way the world arranges its levels (the grandma audit, section 5.2).
  { id: 'free', label: 'Anywhere' },
  { id: 'grid', label: 'In a grid' },
  { id: 'horizontal', label: 'In a row' },
  { id: 'vertical', label: 'In a column' },
]
</script>

<div class="panel" data-scroll-region>
  {#if project !== undefined && project.worlds.length > 1}
    <Segmented
      label="World"
      options={project.worlds.map((candidate) => ({ id: candidate.id, label: candidate.id }))}
      bind:value={worldId}
    />
  {/if}
  {#if world !== undefined}
    <div class="arrange">
      <h2>Arrange levels</h2>
      <p class="hint">Where your levels sit on the map. Drag a level to move it.</p>
      <Segmented
        label="Arrange levels"
        options={LAYOUTS}
        value={world.layout}
        onedit={(event) => onlayout(event.value as WorldLayout)}
      />
    </div>
  {/if}
  <h2>Levels</h2>
  <ul class="levels" aria-label="Levels">
    {#each levels as level (level.id)}
      <li>
        <button type="button" aria-pressed={level.id === selected} onclick={() => (selected = level.id)}>
          {level.name}
        </button>
      </li>
    {/each}
  </ul>
  {#if onadd !== undefined}
    <Button onclick={onadd}>Add level</Button>
  {/if}
</div>

<style>
  /* Four ways in plain words do not fit one row of the 264 px panel: they wrap to two, each keeping its words. */
  .arrange :global(.segmented) {
    flex-wrap: wrap;
  }
  .panel {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
    gap: var(--space-3);
    height: 100%;
    padding: var(--space-3);
    overflow-y: auto;
  }
  .levels {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  /* A section label in small capitals, as the approved mockup draws it (the Level view's Layers). The list and the
     switch keep their own accessible names as well. */
  h2 {
    margin: 0;
    padding: 0 var(--space-2);
    color: var(--muted);
    font: var(--text-eyebrow-11);
    letter-spacing: var(--text-eyebrow-11-tracking);
    text-transform: uppercase;
  }
  .arrange {
    display: grid;
    gap: var(--space-2);
  }
  .hint {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  /* Quiet rows, as the Level view's layers: no box, a wash under the pointer and on the chosen level. */
  .levels button {
    box-sizing: border-box;
    width: 100%;
    min-height: var(--size-hit);
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--edge-sm);
    background: transparent;
    color: var(--color-text-primary);
    font: var(--text-body-13);
    text-align: left;
    cursor: pointer;
  }
  .levels button:hover {
    background: var(--tool-hover, var(--color-bg-raised));
  }
  .levels button[aria-pressed='true'] {
    background: var(--color-accent-soft);
    font-weight: 500;
  }
  .levels button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
</style>
