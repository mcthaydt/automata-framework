<!--
  A wall's card (ED3D.5f; ED3D spec §5.4 wall commands, §9): which wall, its length; its kind (Solid, Door, Window; a
  Portal is made with the Portal tool, which knows the room behind it); the door's or the window's place and size; how
  the 3D views hide it (occlude); its handrail. Each change is one undo step; a scrub of a stepper is one too.
-->
<script lang="ts">
import { Button, Segmented, Stepper } from '@automata/editor/kit'
import type { InspectorCard } from '../../app/inspector-cards'
import type { InspectorChange, InspectorPhase } from '../../app/inspector-edits'
import type { MaterialTarget } from '../../app/material-session'
import type { Occlude } from '../../format/sector.schema'

type WallCardData = Extract<InspectorCard, { kind: 'wall' }>

interface Props {
  card: WallCardData
  onchange: (change: InspectorChange, phase: InspectorPhase) => void
  /** Opens the material sheet on this wall. */
  onmaterial?: ((target: MaterialTarget) => void) | undefined
}

const { card, onchange, onmaterial }: Props = $props()

const wall = $derived({ kind: 'wall' as const, sector: card.sector, corner: card.corner })
const kinds = $derived([
  { id: 'solid', label: 'Solid' },
  { id: 'door', label: 'Door' },
  { id: 'window', label: 'Window' },
  {
    id: 'portal',
    label: 'Portal',
    disabled: card.type !== 'portal',
    reason: 'Use the Portal tool: it finds the room behind the wall',
  },
])
const occludes = [
  { id: 'cut', label: 'Cut' },
  { id: 'fade', label: 'Fade' },
  { id: 'never', label: 'Never' },
]
</script>

<h2>Wall {card.corner + 1} of {card.sector}</h2>
<p class="meta">
  {card.length.toFixed(2)} m{card.type === 'portal' && card.to !== undefined ? ` · into ${card.to}` : ''}{card.preset ===
  undefined
    ? ''
    : ` · ${card.preset}`}
</p>
<Segmented
  label="Kind"
  options={kinds}
  value={card.type}
  onedit={(event) => {
    if (event.value !== 'portal') onchange({ ...wall, type: event.value as 'solid' | 'door' | 'window' }, 'set')
  }}
/>
{#if card.door !== undefined}
  <div class="pair">
    <Stepper
      label="Door at"
      value={card.door.at}
      step={0.05}
      unit="m"
      onedit={(event) => onchange({ ...wall, door: { at: event.value } }, event.phase)}
    />
    <Stepper
      label="Door width"
      value={card.door.width}
      step={0.05}
      unit="m"
      onedit={(event) => onchange({ ...wall, door: { width: event.value } }, event.phase)}
    />
    <Stepper
      label="Door height"
      value={card.door.height}
      step={0.05}
      unit="m"
      onedit={(event) => onchange({ ...wall, door: { height: event.value } }, event.phase)}
    />
  </div>
{/if}
{#if card.window !== undefined}
  <div class="pair">
    <Stepper
      label="Window at"
      value={card.window.at}
      step={0.05}
      unit="m"
      onedit={(event) => onchange({ ...wall, window: { at: event.value } }, event.phase)}
    />
    <Stepper
      label="Window width"
      value={card.window.width}
      step={0.05}
      unit="m"
      onedit={(event) => onchange({ ...wall, window: { width: event.value } }, event.phase)}
    />
    <Stepper
      label="Sill"
      value={card.window.y0}
      step={0.05}
      unit="m"
      onedit={(event) => onchange({ ...wall, window: { y0: event.value } }, event.phase)}
    />
    <Stepper
      label="Head"
      value={card.window.y1}
      step={0.05}
      unit="m"
      onedit={(event) => onchange({ ...wall, window: { y1: event.value } }, event.phase)}
    />
  </div>
{/if}
<Segmented
  label="Hide in 3D"
  options={occludes}
  value={card.occlude ?? 'cut'}
  onedit={(event) => onchange({ ...wall, occlude: event.value as Occlude }, 'set')}
/>
<Stepper
  label="Handrail"
  value={card.handrail ?? 0}
  min={0}
  step={0.05}
  unit="m"
  onedit={(event) => onchange({ ...wall, flags: { handrail: event.value === 0 ? null : event.value } }, event.phase)}
/>
{#if onmaterial}
  <Button onclick={() => onmaterial({ wall: { sector: card.sector, corner: card.corner } })}>Material</Button>
{/if}

<style>
  /* One stepper to a row: two side by side wrap their buttons in the 320 px column. */
  .pair {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
</style>
