<!-- The world's rules: what the game does whatever any character is doing. Each reads "When … then …". -->
<script lang="ts">
import type { Probe, SysEffect } from '@automata/systems/sim'
import FieldRow from '../../shared/ui/FieldRow.svelte'
import { namesOf } from './names.ts'
import PieceRow from './PieceRow.svelte'
import { actionPiece, actionWords } from './pieces/actions.ts'
import { conditionPiece, conditionWords } from './pieces/conditions.ts'
import type { SchematicSession } from './schematic-session.svelte.ts'

const { session }: { session: SchematicSession } = $props()
const def = $derived(session.def)
const names = $derived(
  def === undefined ? undefined : namesOf(def, -1, Object.keys(session.places?.nodes ?? {})),
)
</script>

<section class="rules" aria-label="Rules">
  <h2>Rules</h2>
  <p class="dim">What the game does whatever any character is doing.</p>
  {#if def !== undefined && names !== undefined}
    {#if def.rules.length === 0}<p class="dim">No rules yet.</p>{/if}
    <ul>
      {#each def.rules as rule, r (rule.id)}
        <li class="card">
          <p class="sentence">
            {#if rule.when.length === 0 && rule.then.length === 0}
              {rule.text}
            {:else}
              When {rule.when.length === 0 ? 'the game runs' : rule.when.map((p) => conditionWords(p, names)).join(' and ')}, then
              {rule.then.map((e) => actionWords(e, names)).join(', ')}{rule.every === undefined ? '' : `, every ${String(rule.every)} s`}
            {/if}
          </p>
          <FieldRow label="What it is for" kind="text" value={rule.text} onchange={(next) => void session.setRule('Change a rule', r, { ...rule, text: String(next) })} />
          {#if rule.every !== undefined}
            <FieldRow label="Every" kind="number" unit="s" min={0.1} max={3600} step={0.5} value={rule.every} onchange={(next) => void session.setRule('Change a rule', r, { ...rule, every: Number(next) })} />
          {/if}
          <h3>It happens when</h3>
          <ul>
            {#each rule.when as probe, i (i)}
              <PieceRow
                piece={conditionPiece(probe)}
                value={probe}
                {names}
                fallback={conditionWords(probe, names)}
                onwrite={(next: Probe) => void session.setRule('Change a rule', r, { ...rule, when: rule.when.map((p, j) => (j === i ? next : p)) })}
              />
            {/each}
          </ul>
          <h3>Then</h3>
          <ul>
            {#each rule.then as effect, i (i)}
              <PieceRow
                piece={actionPiece(effect)}
                value={effect}
                {names}
                fallback={actionWords(effect, names)}
                onwrite={(next: SysEffect) => void session.setRule('Change a rule', r, { ...rule, then: rule.then.map((e, j) => (j === i ? next : e)) })}
              />
            {/each}
          </ul>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .rules {
    display: grid;
    gap: var(--space-3);
  }
  h2 {
    margin: 0;
    color: var(--color-text-primary);
    font: var(--text-title-15);
  }
  h3 {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13-medium);
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
    padding: var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-surface);
  }
  .sentence {
    margin: 0;
    color: var(--color-text-primary);
    font: var(--text-body-13-medium);
  }
  .dim {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
</style>
