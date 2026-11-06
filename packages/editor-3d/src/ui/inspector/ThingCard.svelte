<!--
  A thing's card (ED3D.5f, ED3D.7d-b; ED3D spec §4.7): its id, definition and place, a row per field of the definition in
  the kit's field form, and Delete. A field edit goes out as one `set` change; the model's sentence for a refusal shows
  under the field it is about (the form rebuilds the control from the stored value), and a delete's under the card.
-->
<script lang="ts">
import { Button, FieldEditor } from '@mcthaydt/automata-editor/kit'
import type { InspectorCard } from '../../app/inspector-cards'
import type { InspectorChange, InspectorPhase } from '../../app/inspector-edits'

type ThingCardData = Extract<InspectorCard, { kind: 'thing' }>

interface Props {
  card: ThingCardData
  /** A change whose refusal the inspector shows under the card (Delete). */
  onchange: (change: InspectorChange, phase: InspectorPhase) => void
  /** A field's change: the model's sentence comes back for the field to show under itself. */
  onfield: (change: InspectorChange) => string | undefined
}

const { card, onchange, onfield }: Props = $props()

const metres = (value: number): string => value.toFixed(2)
</script>

<h2>{card.id}</h2>
<p class="meta">{card.definition} · x {metres(card.x)} · z {metres(card.z)}{card.y === undefined ? '' : ` · y ${metres(card.y)}`}</p>
{#each card.fields as row (row.id)}
  <FieldEditor
    {row}
    palette={[]}
    oncommit={(value) => {
      const message = onfield({ kind: 'thing', definition: card.definition, id: card.id, field: row.id, value })
      return message === undefined ? { ok: true } : { ok: false, message }
    }}
  />
{/each}
<Button
  variant="danger"
  aria-label={`Delete ${card.id}`}
  onclick={() => onchange({ kind: 'thing', definition: card.definition, id: card.id, remove: true }, 'set')}
>
  Delete
</Button>
