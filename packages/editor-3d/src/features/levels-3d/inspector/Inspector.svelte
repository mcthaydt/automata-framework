<!--
  The inspector (ED3D.5f; ED3D spec §9 the Split frame's sector card): the card for what is selected, from
  `inspectorOf`. Each change goes out with the widget's phase (a stepper's press is a `set`, a scrub `start` to
  `commit`) and comes back with the model's sentence when it is refused, which the card shows until the next change.
  Several selected show the first and say so; nothing selected says how to select.
-->
<script lang="ts">
import { Button, Picker } from '@automata/editor/kit'
import type { InspectorCard } from './inspector-cards'
import type { InspectorChange, InspectorPhase } from './inspector-edits'
import type { MaterialTarget } from './material-session'
import SectorCard from './SectorCard.svelte'
import ThingCard from './ThingCard.svelte'
import WallCard from './WallCard.svelte'

interface Props {
  card: InspectorCard
  /** Runs a change; answers the model's sentence when it is refused. */
  onchange: (change: InspectorChange, phase: InspectorPhase) => string | undefined
  /** Opens the material sheet on a wall or a room's surface. */
  onmaterial?: ((target: MaterialTarget) => void) | undefined
  /** Opens the definitions sheet. */
  ondefinitions?: (() => void) | undefined
}

const { card, onchange, onmaterial, ondefinitions }: Props = $props()

let refusal = $state<string | undefined>()

/** The times by their words, and the way back to the game's own look. */
const timeOptions = $derived([
  ...(card.kind === 'none' ? (card.time?.options ?? []) : []),
  { id: '', label: 'As the game has it' },
])

/** A field edit shows its refusal under the field itself, so it only clears the card's. */
function field(next: InspectorChange): string | undefined {
  refusal = undefined
  return onchange(next, 'set')
}

function change(next: InspectorChange, phase: InspectorPhase): void {
  refusal = onchange(next, phase)
}
</script>

<section class="inspector" aria-label="Inspector" data-testid="inspector">
  {#if card.selected > 1}
    <p class="several">{card.selected} selected: showing the first</p>
  {/if}
  {#if card.kind === 'none'}
    <p class="empty">Tap a room, a wall or a thing to see it here.</p>
    {#if card.time !== undefined}
      <Picker
        label="Time of day"
        value={card.time.value ?? ''}
        options={timeOptions}
        onpick={(id) =>
          change(
            id === ''
              ? { kind: 'level', time: null }
              : { kind: 'level', time: id, label: card.time?.options.find((each) => each.id === id)?.label ?? id },
            'set',
          )}
      />
    {/if}
  {:else if card.kind === 'sector'}
    <SectorCard {card} onchange={change} {onmaterial} />
  {:else if card.kind === 'wall'}
    <WallCard {card} onchange={change} {onmaterial} />
  {:else}
    <ThingCard {card} onchange={change} onfield={field} />
  {/if}
  {#if refusal !== undefined}
    <p class="refusal" role="alert">{refusal}</p>
  {/if}
  {#if ondefinitions}<Button onclick={ondefinitions}>Definitions…</Button>{/if}
</section>

<style>
  .inspector {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    color: var(--color-text-primary);
  }
  .inspector :global(h2) {
    margin: 0;
    font: var(--text-title-15);
  }
  .inspector :global(.meta) {
    margin: 0;
    color: var(--color-text-dim);
    font: 500 12px / 16px var(--font-mono, monospace);
  }
  .several,
  .empty {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .refusal {
    margin: 0;
    color: var(--color-state-bad);
    font: var(--text-body-13);
  }
</style>
