<!-- A ready-made character: each behaviour described in a line, patrolling the scene's first places. -->
<script lang="ts">
import { PRESETS, type PresetKind, presetAgent } from './presets.ts'
import type { SchematicSession } from './schematic-session.svelte.ts'

const { session, disabled = false }: { session: SchematicSession; disabled?: boolean } = $props()

function add(choice: string): void {
  const preset = PRESETS.find((p) => p.kind === choice)
  if (preset === undefined) return
  const places = Object.keys(session.places?.nodes ?? {})
  void session.addCharacter(presetAgent(preset.kind as PresetKind, preset.kind, places))
}
</script>

<label class="add">
  <span>Add a ready-made character</span>
  <select
    {disabled}
    value=""
    onchange={(event) => {
      const choice = event.currentTarget.value
      event.currentTarget.value = ''
      add(choice)
    }}
  >
    <option value="">Choose…</option>
    {#each PRESETS as preset (preset.kind)}
      <option value={preset.kind}>{preset.title}: {preset.words}</option>
    {/each}
  </select>
</label>

<style>
  .add {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-1);
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  select {
    min-height: var(--size-hit);
    min-width: 0;
    max-width: 100%;
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-surface);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
</style>
