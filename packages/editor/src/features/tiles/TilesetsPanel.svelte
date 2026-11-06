<!--
  The Tilesets view's panel (plan ED2D.5b decision 6; mockup `tileset`): the tilesets, the auto layers, the selected
  layer's rule groups, and the selected group's rules as a strip the kit `ReorderList` reorders by its 44 px grip
  (Space lifts a row, the arrows move it, Space drops it; one drop is one undo step). Each rule row shows its pattern,
  its first output tile, its id and a summary.
-->
<script lang="ts">
import Button from '../../shared/kit/widgets/Button.svelte'
import ReorderList from '../../shared/kit/widgets/ReorderList.svelte'
import type { Project } from '../../shared/level-2d/model/project-types'
import { tileItems } from '../../shared/level-2d/tiles/palette-model'
import { spriteStyle } from '../../shared/level-2d/tiles/tile-sprite'
import PatternThumb from './PatternThumb.svelte'
import {
  autoLayerRows,
  autoLayersOf,
  groupRows,
  type ResolvedSelection,
  ruleRows,
  tilesetRows,
} from './tilesets-model'
import type { TilesetsSession } from './tilesets-session'

interface Props {
  project: Project
  selection: ResolvedSelection
  session: TilesetsSession
  images: ReadonlySet<string>
  imageUrl: (path: string) => string | undefined
}

const { project, selection, session, images, imageUrl }: Props = $props()

const THUMB = 30
const layer = $derived(autoLayersOf(project).find((def) => def.id === selection.layer))
const groups = $derived(layer === undefined ? [] : groupRows(layer))
const group = $derived(groups.find((each) => each.id === selection.group))
const rules = $derived(layer === undefined || group === undefined ? [] : ruleRows(layer, group.id))
const tiles = $derived(
  tileItems(
    project.defs.tilesets.find((set) => set.id === layer?.tileset),
    images,
  ),
)
const subOf = (id: string): string => rules.find((rule) => rule.id === id)?.sub ?? ''

function thumb(tile: number | undefined): string {
  const item = tiles.find((each) => each.tile === tile)
  if (item === undefined) return 'background-color: transparent'
  return spriteStyle(item, item.image === undefined ? undefined : imageUrl(item.image.path), THUMB)
}
</script>

<div class="panel" data-testid="tilesets-panel">
  <section aria-labelledby="tilesets-heading">
    <h2 id="tilesets-heading">Tilesets</h2>
    <div class="choices" role="radiogroup" aria-labelledby="tilesets-heading">
      {#each tilesetRows(project) as row (row.id)}
        <button
          type="button"
          role="radio"
          class="row"
          aria-checked={row.id === selection.tileset}
          onclick={() => session.select({ tileset: row.id })}
        >
          <span class="name">{row.label}</span>
          <span class="sub">{row.sub}</span>
        </button>
      {/each}
    </div>
  </section>

  <section aria-labelledby="auto-heading">
    <h2 id="auto-heading">Auto layers</h2>
    {#if layer === undefined}
      <p class="empty">No auto layer reads an IntGrid yet.</p>
    {:else}
      <div class="choices" role="radiogroup" aria-labelledby="auto-heading">
        {#each autoLayerRows(project) as row (row.id)}
          <button
            type="button"
            role="radio"
            class="row"
            aria-checked={row.id === selection.layer}
            onclick={() => session.select({ layer: row.id })}
          >
            <span class="name">{row.label}</span>
            <span class="sub">{row.sub}</span>
          </button>
        {/each}
      </div>
    {/if}
  </section>

  {#if layer !== undefined}
    <section aria-labelledby="groups-heading">
      <div class="head">
        <h2 id="groups-heading">Rule groups · {layer.label}</h2>
        <Button aria-label="Add group" onclick={() => session.addGroup()}>+</Button>
      </div>
      <ReorderList
        label="Rule groups"
        items={groups.map((row) => ({ id: row.id, label: row.label }))}
        onreorder={(move) => session.reorderGroups(move.from, move.to)}
      >
        {#snippet item(row)}
          {@const found = groups.find((each) => each.id === row.id)}
          <button
            type="button"
            class="row"
            class:off={found?.active === false}
            aria-pressed={row.id === selection.group}
            onclick={() => session.select({ group: row.id, rule: undefined })}
          >
            <span class="name">{row.label}</span>
            <span class="sub">{found?.sub}</span>
          </button>
        {/snippet}
      </ReorderList>
    </section>

    {#if group !== undefined}
      <section aria-labelledby="rules-heading" class="rules">
        <div class="head">
          <h2 id="rules-heading">Rules · {group.label}</h2>
          <Button aria-label="Add rule" onclick={() => session.addRule()}>+</Button>
        </div>
        {#if rules.length === 0}
          <p class="empty">No rules in this group yet. Add one to start.</p>
        {:else}
          <ReorderList
            label="Rules"
            items={rules.map((row) => ({ id: row.id, label: row.label }))}
            onreorder={(move) => session.reorderRules(move.from, move.to)}
          >
            {#snippet item(row)}
              {@const found = rules.find((each) => each.id === row.id)}
              <button
                type="button"
                class="row rule"
                class:off={found?.active === false}
                aria-pressed={row.id === selection.rule}
                data-rule={row.id}
                onclick={() => session.select({ rule: row.id })}
              >
                {#if found !== undefined}
                  <PatternThumb size={found.size} pattern={found.pattern} />
                {/if}
                <span class="thumb" style={thumb(found?.firstTile)} aria-hidden="true"></span>
                <span class="text">
                  <span class="name">{row.label}</span>
                  <span class="sub">{subOf(row.id)}</span>
                </span>
              </button>
            {/snippet}
          </ReorderList>
        {/if}
      </section>
    {/if}
  {/if}
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
  h2 {
    margin: 0;
    padding: var(--space-2) var(--space-2) 0;
    color: var(--color-text-dim);
    font: var(--text-label-12);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    align-content: center;
    width: 100%;
    min-width: 0;
    min-height: 44px;
    padding: var(--space-1) var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
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
  .row.off .name {
    color: var(--color-text-dim);
  }
  .rule {
    grid-template-columns: auto auto minmax(0, 1fr);
    align-items: center;
    gap: var(--space-2);
  }
  .thumb {
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    background-repeat: no-repeat;
    image-rendering: pixelated;
  }
  .text {
    display: grid;
    min-width: 0;
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
