<!-- The scene's numbers: each with its name in words, its value, how far it may go, and what it is for. -->
<script lang="ts">
import FieldRow from '../../shared/ui/FieldRow.svelte'
import { modeWords, num } from './pieces/piece.ts'
import type { SchematicSession } from './schematic-session.svelte.ts'

const { session }: { session: SchematicSession } = $props()
const rows = $derived(Object.entries(session.def?.tunables ?? {}))
</script>

<section class="numbers" aria-label="Numbers">
  <h2>Numbers</h2>
  {#if rows.length === 0}<p class="dim">This scene has no numbers to tune.</p>{/if}
  <ul>
    {#each rows as [name, t] (name)}
      <li class="card">
        <FieldRow
          label={modeWords(name)}
          kind="number"
          unit={t.unit}
          min={t.min}
          max={t.max}
          step={(t.max - t.min) / 100}
          value={t.value}
          onchange={(next) => void session.setNumber(name, Number(next))}
        />
        <p class="dim">From {num(t.min)} to {num(t.max)} {t.unit}. {t.note}</p>
      </li>
    {/each}
  </ul>
</section>

<style>
  .numbers {
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
    gap: var(--space-1);
    padding: var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-surface);
  }
  .dim {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
</style>
