<!--
  A sector's card (ED3D.5f; ED3D spec §9, the Split frame's Sector section): its name, walls and portals; floor and
  ceiling steppers (5 cm a step, a scrub one undo step); the light slider; its style and textures. Change materials opens
  the material sheet (ED3D.8b).
-->
<script lang="ts">
import { Button, Slider, Stepper } from '@mcthaydt/automata-editor/kit'
import type { InspectorCard } from '../../app/inspector-cards'
import type { InspectorChange, InspectorPhase } from '../../app/inspector-edits'
import type { MaterialTarget } from '../../app/material-session'

type SectorCardData = Extract<InspectorCard, { kind: 'sector' }>

interface Props {
  card: SectorCardData
  onchange: (change: InspectorChange, phase: InspectorPhase) => void
  /** Opens the material sheet on this room's walls. */
  onmaterial?: ((target: MaterialTarget) => void) | undefined
}

const { card, onchange, onmaterial }: Props = $props()

const plural = (count: number, one: string): string => `${count} ${one}${count === 1 ? '' : 's'}`
const materials = $derived(
  (
    [
      ['Floor', card.floorTexture],
      ['Walls', card.wallTexture],
      ['Ceiling', card.ceilingTexture],
    ] as const
  ).map(([label, value]) => ({ label, value: value ?? 'the level’s default' })),
)
</script>

<h2>{card.id}</h2>
<p class="meta">{plural(card.walls, 'wall')} · {plural(card.portals, 'portal')}</p>
<div class="pair">
  <Stepper
    label="Floor"
    value={card.floor}
    step={0.05}
    unit="m"
    onedit={(event) => onchange({ kind: 'sector', id: card.id, floor: event.value }, event.phase)}
  />
  <Stepper
    label="Ceiling"
    value={card.ceiling}
    step={0.05}
    unit="m"
    onedit={(event) => onchange({ kind: 'sector', id: card.id, ceiling: event.value }, event.phase)}
  />
</div>
<Slider
  label="Light"
  value={card.light}
  min={0}
  max={1}
  step={0.05}
  onedit={(event) => onchange({ kind: 'sector', id: card.id, light: event.value }, event.phase)}
/>
<ul class="materials" aria-label="Materials">
  {#each materials as material (material.label)}
    <li><span class="label">{material.label}</span> <span class="value">{material.value}</span></li>
  {/each}
</ul>
<Button disabled={onmaterial === undefined} onclick={() => onmaterial?.({ sector: card.id, surface: 'walls' })}>
  Change materials
</Button>
{#if card.style !== undefined}<p class="meta">Style {card.style}</p>{/if}

<style>
  /* One stepper to a row: two side by side wrap their buttons in the 320 px column. */
  .pair {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .materials {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
    font: var(--text-body-13);
  }
  .label {
    display: inline-block;
    min-width: 7ch;
    color: var(--color-text-dim);
  }
</style>
