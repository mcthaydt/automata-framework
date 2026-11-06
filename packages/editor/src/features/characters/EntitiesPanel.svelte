<!--
  The Entities view's panel: the entity definitions, each with its colour, id and a
  summary, then the level fields every level carries. Choosing a definition or "Level fields" sets whose fields the
  inspector edits; the add buttons make a new definition or a new level field, each one undo step.
-->
<script lang="ts">
import Button from '../../shared/kit/widgets/Button.svelte'
import type { Project } from '../../shared/level-2d/model/project-types'
import { definitionRows, levelFieldRows, type ResolvedEntitiesSelection } from './entities-model'
import type { EntitiesSession } from './entities-session'

interface Props {
  project: Project
  selection: ResolvedEntitiesSelection
  session: EntitiesSession
}

const { project, selection, session }: Props = $props()

const selectedDef = $derived(selection.owner === 'level' ? undefined : selection.owner.entity)
const levelFields = $derived(levelFieldRows(project))
</script>

<div class="panel" data-testid="entities-panel">
  <section aria-labelledby="definitions-heading">
    <div class="head">
      <h2 id="definitions-heading">Characters</h2>
      <Button aria-label="Add entity" onclick={() => session.addDefinition()}>+</Button>
    </div>
    <div class="choices" role="radiogroup" aria-labelledby="definitions-heading">
      {#each definitionRows(project) as row (row.id)}
        <button
          type="button"
          role="radio"
          class="row"
          aria-checked={row.id === selectedDef}
          onclick={() => session.select({ owner: { entity: row.id } })}
        >
          <span class="swatch" style:--swatch={row.color ?? 'var(--color-text-dim)'} aria-hidden="true"></span>
          <span class="text">
            <span class="name">{row.label ?? row.id}</span>
            {#if row.summary !== ''}<span class="sub">{row.summary}</span>{/if}
          </span>
        </button>
      {:else}
        <p class="empty">No entity definitions yet.</p>
      {/each}
    </div>
  </section>

  <section aria-labelledby="level-fields-heading">
    <div class="head">
      <h2 id="level-fields-heading">Settings for every level</h2>
      <Button
        aria-label="Add level field"
        onclick={() => {
          session.select({ owner: 'level' })
          session.addField()
        }}>+</Button
      >
    </div>
    <button
      type="button"
      class="row"
      aria-pressed={selection.owner === 'level'}
      onclick={() => session.select({ owner: 'level' })}
    >
      <span class="text">
        <span class="name">Settings for every level</span>
        <span class="sub">
          {levelFields.length === 0 ? 'none yet' : levelFields.map((row) => row.id).join(' · ')}
        </span>
      </span>
    </button>
  </section>
</div>

<style>
  .panel {
    display: grid;
    align-content: start;
    gap: var(--space-3);
    padding: var(--space-2) 0 var(--space-4);
  }
  section {
    display: grid;
    gap: var(--space-1);
    padding: 0 var(--space-2);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  /* A section label in small capitals, as the approved mockup draws it (the Level view's Layers). */
  h2 {
    margin: 0;
    padding: var(--space-2) var(--space-2) 0;
    color: var(--muted);
    font: var(--text-eyebrow-11);
    letter-spacing: var(--text-eyebrow-11-tracking);
    text-transform: uppercase;
  }
  .empty {
    margin: 0;
    padding: 0 var(--space-2);
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .choices {
    display: grid;
    gap: 2px;
  }
  .row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    min-width: 0;
    min-height: 48px;
    padding: var(--space-1) var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--edge-sm);
    background: transparent;
    color: var(--color-text-primary);
    text-align: start;
    cursor: pointer;
  }
  .row[aria-checked='true'],
  .row[aria-pressed='true'] {
    border-color: color-mix(in srgb, var(--color-accent-default) 60%, transparent);
    background: var(--color-accent-soft);
  }
  .row:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: 2px;
  }
  .swatch {
    width: 30px;
    height: 30px;
    border-radius: var(--edge-sm);
    background: color-mix(in srgb, var(--swatch) 30%, transparent);
    box-shadow: inset 0 0 0 2px var(--swatch);
  }
  .text {
    display: grid;
    grid-column: span 1;
    min-width: 0;
  }
  .row:not(:has(.swatch)) .text {
    grid-column: 1 / -1;
  }
  .name {
    font: var(--text-body-13-medium);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sub {
    color: var(--color-text-dim);
    font: var(--text-mono-11);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
