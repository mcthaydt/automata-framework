<!--
  The mix: how loud everything is overall, and the ducks, each a sentence ("While a voice plays, music drops 6 dB").
  A duck quiets some sounds while another plays, so a line of speech is not buried. Both are heard in play.
-->
<script lang="ts">
import type { DuckRule } from '@automata/audio-synth'
import { Button } from '@automata/editor/kit'
import Check from '../../shared/ui/Check.svelte'
import FieldRow from '../../shared/ui/FieldRow.svelte'
import { removeEdit } from './audio-model.ts'
import type { AudioSession } from './audio-session.svelte.ts'
import { addDuckEdits, duckBusEdits, duckFieldEdit, duckLines, masterEdit, masterField } from './mix-model.ts'

const { session }: { session: AudioSession } = $props()
const content = $derived(session.content)
</script>

{#if content !== undefined}
  <h2>Mix</h2>
  <p>How loud the game is, and what gets quieter while a sound plays.</p>
  {@const master = masterField(content)}
  <div class="card">
    <FieldRow
      label={master.label}
      kind="number"
      value={master.kind === 'number' ? master.value : 1}
      min={0}
      max={1}
      step={0.05}
      onchange={(value) => void session.change('Change the overall volume', [masterEdit(content, Number(value))], 'master_gain')}
    />
  </div>
  {#each duckLines(content) as duck (duck.index)}
    {@const rule = content.duck?.[duck.index] as DuckRule}
    <div class="card" role="group" aria-label={duck.words}>
      <h3>{duck.words}</h3>
      {#each duck.fields as one (one.key)}
        <FieldRow
          label={one.label}
          kind={one.kind}
          value={one.value}
          options={one.kind === 'choice' ? one.options : undefined}
          unit={one.kind === 'number' ? one.unit : undefined}
          min={one.kind === 'number' ? one.min : undefined}
          max={one.kind === 'number' ? one.max : undefined}
          step={one.kind === 'number' ? one.step : undefined}
          onchange={(value) =>
            void session.change(`Change ${one.label.toLowerCase()}`, [duckFieldEdit(duck.index, rule, one, value)], `duck.${String(duck.index)}.${one.key}`)}
        />
      {/each}
      <fieldset>
        <legend>These get quieter</legend>
        {#each duck.buses as bus (bus.bus)}
          <Check
            checked={bus.on}
            disabled={bus.on && rule.duck.length <= 1}
            onchange={(on) => void session.change(`Change what gets quieter`, duckBusEdits(duck.index, rule, bus.bus, on))}
          >
            {bus.label}
          </Check>
        {/each}
      </fieldset>
      <div class="actions">
        <Button variant="quiet" onclick={() => void session.change('Remove a duck', [removeEdit('duck', duck.index)])}>
          Remove
        </Button>
      </div>
    </div>
  {:else}
    <p>Nothing gets quieter while another sound plays.</p>
  {/each}
  <div class="actions">
    <Button onclick={() => void session.change('Add a duck', addDuckEdits(content))}>
      Quiet something while a sound plays
    </Button>
  </div>
{/if}

<style>
  fieldset {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    padding: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
</style>
