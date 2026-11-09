<!--
  The definitions editor (ED3D.13b; ED3D spec §4.7, §5.4, ED3-r): the level's entity definitions, each with the fields its
  things have. Add a definition (an id and a shape), rename or remove it, add a field (an id and a type), retype or rename
  a field, remove it. Every change is one undo step and answers the model's own sentence when it is refused (a retype an
  instance would not survive, a definition still in use), which is shown until the next change. Type is a native select,
  which is the right picker on a tablet.
-->
<script lang="ts">
import { Button, Segmented } from '@automataframework/automata-editor/kit'
import { FIELD_TYPES, type FieldType } from '@automataframework/automata-editor/kit/fields'
import type { DefinitionRow } from '../../app/definitions-controller'

interface Props {
  rows: readonly DefinitionRow[]
  /** Each answers the model's sentence when refused, `undefined` when made. */
  onadd: (definition: { id: string; shape: 'point' | 'box' }) => string | undefined
  onrename: (id: string, to: string) => string | undefined
  onremove: (id: string) => string | undefined
  onaddfield: (def: string, field: { id: string; type: FieldType }) => string | undefined
  onchangefield: (def: string, id: string, field: { id: string; type: FieldType }) => string | undefined
  onremovefield: (def: string, id: string) => string | undefined
}

const { rows, onadd, onrename, onremove, onaddfield, onchangefield, onremovefield }: Props = $props()

let refusal = $state<string | undefined>()
let newId = $state('')
let newShape = $state<'point' | 'box'>('point')
let fieldDrafts = $state<Record<string, { id: string; type: FieldType }>>({})

const shapes = [
  { id: 'point', label: 'Point' },
  { id: 'box', label: 'Box' },
]

function settle(answer: string | undefined): boolean {
  refusal = answer
  return answer === undefined
}

function add(): void {
  if (settle(onadd({ id: newId.trim(), shape: newShape }))) newId = ''
}

const draftOf = (def: string): { id: string; type: FieldType } => fieldDrafts[def] ?? { id: '', type: 'int' }

function addField(def: string): void {
  const draft = draftOf(def)
  if (settle(onaddfield(def, { id: draft.id.trim(), type: draft.type })))
    fieldDrafts[def] = { id: '', type: draft.type }
}
</script>

<div class="definitions">
  {#each rows as row (row.id)}
    <section class="definition" aria-label={`Definition ${row.id}`}>
      <header>
        <input
          class="name"
          aria-label={`Name of ${row.id}`}
          value={row.id}
          onchange={(event) => {
            if (!settle(onrename(row.id, event.currentTarget.value.trim()))) event.currentTarget.value = row.id
          }}
        />
        <span class="meta">{row.shape} · {row.instances} {row.instances === 1 ? 'thing' : 'things'}</span>
        <Button variant="danger" aria-label={`Remove ${row.id}`} onclick={() => settle(onremove(row.id))}>Remove</Button>
      </header>
      <ul class="fields">
        {#each row.fields as field (field.id)}
          <li>
            <input
              class="name"
              aria-label={`Field name in ${row.id}: ${field.id}`}
              value={field.id}
              onchange={(event) => {
                const to = event.currentTarget.value.trim()
                if (!settle(onchangefield(row.id, field.id, { ...field, id: to, type: field.type })))
                  event.currentTarget.value = field.id
              }}
            />
            <select
              aria-label={`Type of ${field.id} in ${row.id}`}
              value={field.type}
              onchange={(event) => {
                const type = event.currentTarget.value as FieldType
                if (!settle(onchangefield(row.id, field.id, { id: field.id, type })))
                  event.currentTarget.value = field.type
              }}
            >
              {#each FIELD_TYPES as type (type)}<option value={type}>{type}</option>{/each}
            </select>
            <Button aria-label={`Remove field ${field.id} from ${row.id}`} onclick={() => settle(onremovefield(row.id, field.id))}>
              Remove
            </Button>
          </li>
        {/each}
      </ul>
      <div class="add">
        <input
          class="name"
          aria-label={`New field in ${row.id}`}
          placeholder="field id"
          value={draftOf(row.id).id}
          oninput={(event) => (fieldDrafts[row.id] = { ...draftOf(row.id), id: event.currentTarget.value })}
        />
        <select
          aria-label={`Type of the new field in ${row.id}`}
          value={draftOf(row.id).type}
          onchange={(event) => (fieldDrafts[row.id] = { ...draftOf(row.id), type: event.currentTarget.value as FieldType })}
        >
          {#each FIELD_TYPES as type (type)}<option value={type}>{type}</option>{/each}
        </select>
        <Button aria-label={`Add field to ${row.id}`} onclick={() => addField(row.id)}>Add field</Button>
      </div>
    </section>
  {/each}
  <section class="definition new" aria-label="New definition">
    <input class="name" aria-label="New definition id" placeholder="definition id" bind:value={newId} />
    <Segmented label="Shape" options={shapes} value={newShape} onedit={(event) => (newShape = event.value as 'point' | 'box')} />
    <Button variant="primary" onclick={add}>Add definition</Button>
  </section>
  {#if refusal !== undefined}<p class="refusal" role="alert">{refusal}</p>{/if}
</div>

<style>
  .definitions {
    display: grid;
    gap: var(--space-4);
  }
  .definition {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--color-border, #8884);
    border-radius: 0.5rem;
  }
  header,
  .add,
  li,
  .new {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .fields {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .name,
  select {
    min-height: 44px;
    padding: 0 var(--space-3);
    font: inherit;
    min-width: 0;
  }
  .meta {
    flex: 1;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .refusal {
    margin: 0;
    color: var(--color-danger, #c0392b);
  }
</style>
