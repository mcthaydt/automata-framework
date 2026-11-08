<!--
  The materials-table editor (ED3D.13b; ED3D spec §4.6, §5.4): the `af-sector` level's own list of materials, the one the
  material sheet shows. Each row is an id (renaming rewrites every use), a category and whether it is for walls only;
  Remove is refused while a wall, a room or a style still uses it. Add takes an id and a category.
-->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import type { MaterialRow } from './definitions-controller'

interface Props {
  rows: readonly MaterialRow[]
  onadd: (id: string, material: { category: string }) => string | undefined
  onchange: (
    id: string,
    material: { category: string; label?: string; wallOnly?: boolean },
  ) => string | undefined
  onrename: (id: string, to: string) => string | undefined
  onremove: (id: string) => string | undefined
}

const { rows, onadd, onchange, onrename, onremove }: Props = $props()

let refusal = $state<string | undefined>()
let newId = $state('')
let newCategory = $state('walls')

function settle(answer: string | undefined): boolean {
  refusal = answer
  return answer === undefined
}

const material = (row: MaterialRow, change: { category?: string; wallOnly?: boolean }) => ({
  category: change.category ?? row.category,
  ...(row.label === undefined ? {} : { label: row.label }),
  wallOnly: change.wallOnly ?? row.wallOnly,
})
</script>

<div class="materials">
  {#if rows.length === 0}<p class="empty">The level has no materials yet. Add one below.</p>{/if}
  <ul>
    {#each rows as row (row.id)}
      <li>
        <input
          class="name"
          aria-label={`Name of material ${row.id}`}
          value={row.id}
          onchange={(event) => {
            if (!settle(onrename(row.id, event.currentTarget.value.trim()))) event.currentTarget.value = row.id
          }}
        />
        <input
          class="name"
          aria-label={`Category of ${row.id}`}
          value={row.category}
          onchange={(event) => {
            if (!settle(onchange(row.id, material(row, { category: event.currentTarget.value.trim() }))))
              event.currentTarget.value = row.category
          }}
        />
        <label class="check">
          <input
            type="checkbox"
            checked={row.wallOnly}
            onchange={(event) => {
              if (!settle(onchange(row.id, material(row, { wallOnly: event.currentTarget.checked }))))
                event.currentTarget.checked = row.wallOnly
            }}
          />
          Walls only
        </label>
        <Button variant="danger" aria-label={`Remove material ${row.id}`} onclick={() => settle(onremove(row.id))}>
          Remove
        </Button>
      </li>
    {/each}
  </ul>
  <div class="add">
    <input class="name" aria-label="New material id" placeholder="material id" bind:value={newId} />
    <input class="name" aria-label="New material category" placeholder="category" bind:value={newCategory} />
    <Button
      variant="secondary"
      onclick={() => {
        if (settle(onadd(newId.trim(), { category: newCategory.trim() }))) newId = ''
      }}
    >
      Add material
    </Button>
  </div>
  {#if refusal !== undefined}<p class="refusal" role="alert">{refusal}</p>{/if}
</div>

<style>
  .materials {
    display: grid;
    gap: var(--space-3);
  }
  ul {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li,
  .add {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .name {
    min-height: 44px;
    padding: 0 var(--space-3);
    font: inherit;
    min-width: 0;
  }
  .check {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
  }
  .empty,
  .refusal {
    margin: 0;
  }
  .refusal {
    color: var(--color-state-bad);
  }
</style>
