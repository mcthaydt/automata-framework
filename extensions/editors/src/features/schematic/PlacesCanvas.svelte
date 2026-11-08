<!-- The scene's places: where each is, which it joins; add, move, join, rename and remove them. -->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import FieldRow from '../../shared/ui/FieldRow.svelte'
import { spaced } from './pieces/piece.ts'
import { neighboursOf, placeSentence } from './places-edits.ts'
import type { SchematicSession } from './schematic-session.svelte.ts'

const { session }: { session: SchematicSession } = $props()
const nav = $derived(session.places)
const names = $derived(Object.keys(nav?.nodes ?? {}))
let open = $state<string | undefined>()
let fresh = $state('')
</script>

<section class="places" aria-label="Places">
  <h2>Places</h2>
  {#if names.length === 0}<p class="dim">No places yet. Characters need places to walk between. Add the first place.</p>{/if}
  <ul>
    {#each names as place (place)}
      {@const at = nav?.nodes[place]}
      <li class="card">
        <button type="button" aria-expanded={open === place} onclick={() => (open = open === place ? undefined : place)}>
          {nav === undefined ? place : placeSentence(nav, place)}
        </button>
        {#if open === place && at !== undefined && nav !== undefined}
          <div class="edit">
            <FieldRow label="Name" kind="text" commit="leave" value={place} onchange={(next) => void session.renamePlace(place, String(next))} />
            <FieldRow label="Across" kind="number" unit="m" min={-500} max={500} step={0.5} value={at.x} onchange={(next) => void session.movePlace(place, 'x', Number(next))} />
            <FieldRow label="Down" kind="number" unit="m" min={-500} max={500} step={0.5} value={at.z} onchange={(next) => void session.movePlace(place, 'z', Number(next))} />
            {#each neighboursOf(nav, place) as other (other)}
              <Button aria-label={`Part ${spaced(place)} from ${spaced(other)}`} onclick={() => void session.disconnectPlaces(place, other)}>Part from {spaced(other)}</Button>
            {/each}
            <label class="join">
              <span>Join to</span>
              <select
                value=""
                onchange={(event) => {
                  const other = event.currentTarget.value
                  event.currentTarget.value = ''
                  if (other !== '') void session.connectPlaces(place, other)
                }}
              >
                <option value="">Choose…</option>
                {#each names.filter((n) => n !== place && !neighboursOf(nav, place).includes(n)) as other (other)}
                  <option value={other}>{spaced(other)}</option>
                {/each}
              </select>
            </label>
            <Button variant="danger" onclick={() => void session.removePlace(place)}>Remove this place</Button>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
  <div class="new">
    <FieldRow label="Name of a new place" kind="text" value={fresh === '' ? 'new place' : fresh} onchange={(next) => (fresh = String(next))} />
    <Button onclick={() => void session.addPlace(fresh === '' ? 'new-place' : fresh, 0, 0)}>Add a place</Button>
  </div>
</section>

<style>
  .places,
  .edit,
  .new {
    display: grid;
    gap: var(--space-3);
  }
  h2 {
    margin: 0;
    color: var(--color-text-primary);
    font: var(--text-title-15);
  }
  ul {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .card {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-2);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-surface);
  }
  .card > button {
    min-height: var(--size-hit);
    border: 0;
    background: transparent;
    color: var(--color-text-primary);
    font: var(--text-body-13);
    text-align: left;
    cursor: pointer;
  }
  .join {
    display: grid;
    gap: var(--space-1);
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  select {
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-surface);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .dim {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
</style>
