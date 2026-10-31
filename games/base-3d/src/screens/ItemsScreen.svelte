<!--
  base-3d's Items screen (DESIGN.md §9.3, GAME-3D.1e part 5b), over the paused game: the five slots as a grid (the
  arrow keys steer it, `[data-focus-grid]`), each owned sling, bombs or hookchain choosable to put it on the Item
  button, the heart pieces as quarters, the embers and the kiln's keys, map and compass. The contents scroll inside a
  declared scroll region at compact height; the frame's corner Back stays fixed.
-->
<script lang="ts">
import { arrowKeyNav, FocusNavigator, ScreenFrame } from '@mcthaydt/automata-ui'
import { onMount } from 'svelte'
import type { Base3dSave } from '../state/save.ts'
import type { ItemName } from './hud.ts'
import { type ItemSlot, itemsOf } from './items.ts'

interface Props {
  save: Base3dSave
  onEquip: (item: ItemName) => void
  onBack: () => void
}

const { save, onEquip, onBack }: Props = $props()

let pending = $state<ItemName | undefined>(undefined)
const view = $derived(itemsOf(save, pending))

// The arrow keys steer focus over the grid by the slots' boxes (ui's FocusNavigator over `[data-focus-grid]`).
onMount(() => {
  const navigator = new FocusNavigator()
  const detach = navigator.attach(window)
  const onKey = (event: KeyboardEvent): void => {
    const direction = arrowKeyNav(event)
    if (direction !== undefined && navigator.steer(direction)) event.preventDefault()
  }
  window.addEventListener('keydown', onKey)
  return () => {
    window.removeEventListener('keydown', onKey)
    detach()
  }
})

const choosable = (slot: ItemSlot): slot is ItemSlot & { id: ItemName } => slot.owned && slot.equippable
function choose(slot: ItemSlot): void {
  if (!choosable(slot)) return
  pending = slot.id
  onEquip(slot.id)
}
</script>

{#snippet header()}
  <h2 class="b3-items__title">Items</h2>
{/snippet}

{#snippet body()}
  <div class="b3-items" data-scroll-region role="region" aria-label="Items" data-testid="items-scroll">
    <div class="b3-items__grid" data-focus-grid>
      {#each view.slots as slot (slot.id)}
        <button
          type="button"
          class="b3-items__slot"
          data-slot={slot.id}
          data-owned={String(slot.owned)}
          aria-disabled={choosable(slot) ? undefined : 'true'}
          aria-pressed={slot.equippable ? String(view.equipped === slot.id) : undefined}
          onclick={() => choose(slot)}
        >
          {#if slot.owned}
            <span class="b3-items__name">{slot.name}</span>
            {#if slot.ammo !== undefined}<span class="b3-items__ammo">{slot.ammo.count} / {slot.ammo.most}</span>{/if}
          {:else}
            <span class="b3-items__name b3-items__name--missing">Not found yet</span>
          {/if}
        </button>
      {/each}
    </div>

    <dl class="b3-items__facts">
      <div>
        <dt>Heart pieces</dt>
        <dd>
          <span class="b3-items__quarters" role="img" aria-label={`${view.heartPieces} of 4`}>
            {#each [0, 1, 2, 3] as quarter (quarter)}
              <span class="b3-items__quarter" data-filled={String(quarter < view.heartPieces)}></span>
            {/each}
          </span>
        </dd>
      </div>
      <div>
        <dt>Embers</dt>
        <dd data-testid="items-embers">{view.embers}</dd>
      </div>
      <div>
        <dt>Small keys</dt>
        <dd>{view.kiln.smallKeys}</dd>
      </div>
      <div>
        <dt>Boss key</dt>
        <dd>{view.kiln.bossKey ? 'Yes' : 'No'}</dd>
      </div>
      <div>
        <dt>Map</dt>
        <dd>{view.kiln.map ? 'Yes' : 'No'}</dd>
      </div>
      <div>
        <dt>Compass</dt>
        <dd>{view.kiln.compass ? 'Yes' : 'No'}</dd>
      </div>
    </dl>
  </div>
{/snippet}

<div class="af-game-menu af-game-menu--scrim" data-game-screen="items">
  <ScreenFrame arrangement="stack" testId="items-screen" back={onBack} backLabel="Back" {header} {body} />
</div>

<style>
  .b3-items__title {
    margin: 0;
    font: var(--af-text-body);
  }
  .b3-items {
    min-block-size: 0;
    block-size: 100%;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: grid;
    align-content: start;
    gap: 12px;
  }
  .b3-items__grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
  }
  .b3-items__slot {
    min-block-size: 64px;
    min-inline-size: 44px;
    display: grid;
    place-content: center;
    gap: 2px;
    padding: 6px;
    border: var(--af-edge-width) solid var(--af-edge);
    border-radius: var(--af-radius);
    background: var(--af-panel);
    color: var(--af-ink);
    font: var(--af-text-small);
    text-align: center;
    overflow-wrap: anywhere;
  }
  .b3-items__slot[data-owned='false'] {
    border-style: dashed;
    background: transparent;
    color: var(--af-muted);
  }
  .b3-items__slot[aria-pressed='true'] {
    border-color: var(--af-accent);
    box-shadow: inset 0 0 0 2px var(--af-accent);
  }
  .b3-items__slot:focus-visible {
    outline: var(--af-ring-width) solid var(--af-ring);
    outline-offset: 2px;
  }
  .b3-items__facts {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
    gap: 4px 12px;
    font: var(--af-text-small);
  }
  .b3-items__facts > div {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .b3-items__facts dt {
    color: var(--af-muted);
  }
  .b3-items__facts dd {
    margin: 0;
  }
  .b3-items__quarters {
    display: inline-grid;
    grid-template-columns: repeat(2, 8px);
    gap: 1px;
  }
  .b3-items__quarter {
    inline-size: 8px;
    block-size: 8px;
    border: 1px solid var(--af-ink);
  }
  .b3-items__quarter[data-filled='true'] {
    background: #e43b44;
  }
</style>
