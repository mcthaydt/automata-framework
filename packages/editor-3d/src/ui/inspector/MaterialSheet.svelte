<!--
  The material sheet (ED3D.8b; ED3D spec §5.3 flow 5, §9): the categories of the level's materials, the tiles of the open
  one, a search, the preview's scale and brightness, the scope (this wall, this room, matching walls) and Apply, which is
  one undo step in the editor's history. It follows the headless picker (`createMaterialPicker`) and holds no state of its
  own beyond what that exposes. A level with no materials table offers nothing and says so; a refusal is shown in the
  model's words and the sheet stays open.
-->
<script lang="ts">
import { Button, Dialog, Segmented, Slider } from '@automataframework/automata-editor/kit'
import { onDestroy } from 'svelte'
import {
  createMaterialPicker,
  type MaterialPickerView,
  type MaterialScope,
  type MaterialTarget,
} from '../../app/material-session'
import type { LevelEditor } from '../../model/level-editor'

interface Props {
  // biome-ignore lint/suspicious/noExplicitAny: the sheet works with any profile's level
  editor: LevelEditor<any>
  /** What the sheet is for: a wall, or a floor, ceiling or walls of a room. */
  surface: MaterialTarget
  onclose: () => void
}

const { editor, surface, onclose }: Props = $props()

// svelte-ignore state_referenced_locally
const picker = createMaterialPicker(editor, { target: surface })
let view = $state<MaterialPickerView>(picker.view)
const stop = picker.subscribe(() => {
  view = picker.view
})
onDestroy(() => {
  stop()
  picker.dispose()
})

$effect(() => {
  picker.retarget(surface)
})

const scopes = $derived([
  { id: 'wall', label: 'wall' in view.target ? 'This wall' : 'This surface' },
  { id: 'room', label: 'This room' },
  { id: 'matching', label: 'Matching' },
])

/** A category id as a sentence-case label: `floors` reads Floors. */
const words = (id: string): string => id.charAt(0).toUpperCase() + id.slice(1)

function apply(): void {
  const result = picker.apply()
  if (result.ok) onclose()
}
</script>

<Dialog open={true} title="Material" width="wide" onclose={onclose}>
  {#if view.unavailable !== undefined}
    <p role="status" class="note">This level has no materials to choose from: {view.unavailable}</p>
  {:else}
    <div class="sheet">
      <div class="categories" role="radiogroup" aria-label="Categories">
        {#each view.categories as category (category.id)}
          <button
            type="button"
            role="radio"
            aria-checked={view.category === category.id}
            class="category"
            class:on={view.category === category.id}
            onclick={() => picker.openCategory(category.id)}
          >
            {words(category.id)} <span class="count">{category.count}</span>
          </button>
        {/each}
      </div>
      <div class="middle">
        <input
          type="search"
          aria-label="Search materials"
          placeholder="Search"
          value={view.search}
          oninput={(event) => picker.search(event.currentTarget.value)}
        />
        {#if view.empty}
          <p class="note">No material matches “{view.search.trim()}”.</p>
        {:else}
          <div class="tiles" role="group" aria-label="Materials">
            {#each view.tiles as tile (tile.id)}
              <button
                type="button"
                role="radio"
                aria-checked={view.selected?.id === tile.id}
                class="tile"
                class:on={view.selected?.id === tile.id}
                onclick={() => picker.select(tile.id)}
              >
                <span class="name">{tile.label ?? tile.id}</span>
                {#if view.current === tile.id}<span class="now">now</span>{/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
      <div class="options">
        <Slider
          label="Scale"
          value={view.scale}
          min={0.25}
          max={4}
          step={0.25}
          defaultValue={1}
          unit="×"
          onedit={(event) => {
            if (event.phase !== 'cancel') picker.setScale(event.value)
          }}
        />
        <Slider
          label="Brightness"
          value={view.brightness}
          min={0}
          max={1.5}
          step={0.05}
          defaultValue={1}
          onedit={(event) => {
            if (event.phase !== 'cancel') picker.setBrightness(event.value)
          }}
        />
        <Segmented
          label="Apply to"
          options={scopes}
          value={view.scope}
          onedit={(event) => picker.setScope(event.value as MaterialScope)}
        />
        {#if view.refusal !== undefined}<p role="alert" class="refusal">{view.refusal}</p>{/if}
      </div>
    </div>
  {/if}
  {#snippet actions({ close })}
    <Button onclick={close}>Cancel</Button>
    <Button variant="primary" disabled={view.unavailable !== undefined} onclick={apply}>Apply</Button>
  {/snippet}
</Dialog>

<style>
  .sheet {
    display: grid;
    grid-template-columns: minmax(6rem, 9rem) minmax(0, 1fr);
    gap: 0.75rem;
  }
  .options {
    grid-column: 1 / -1;
    display: grid;
    gap: 0.5rem;
  }
  .categories {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .category,
  .tile {
    min-height: 44px;
    padding: 0 0.75rem;
    text-align: left;
    border: 1px solid var(--edk-border, #8884);
    border-radius: 0.5rem;
    background: transparent;
    color: inherit;
    font: inherit;
  }
  .category.on,
  .tile.on {
    border-color: var(--edk-accent, #4a90e2);
    background: color-mix(in srgb, var(--edk-accent, #4a90e2) 18%, transparent);
  }
  .count,
  .now {
    opacity: 0.7;
    font-size: 0.8em;
  }
  .middle {
    display: grid;
    gap: 0.5rem;
    min-width: 0;
  }
  input[type='search'] {
    min-height: 44px;
    padding: 0 0.75rem;
    font: inherit;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
    gap: 0.5rem;
    max-height: 40vh;
    overflow-y: auto;
  }
  .note,
  .refusal {
    margin: 0;
  }
  .refusal {
    color: var(--edk-danger, #c0392b);
  }
</style>
