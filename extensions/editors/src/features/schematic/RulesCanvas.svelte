<!-- The world's rules: what the game does whatever any character is doing. Each reads "When … then …". -->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import type { Probe, SysEffect } from '@automata/systems/sim'
import FieldRow from '../../shared/ui/FieldRow.svelte'
import AddPiece from './AddPiece.svelte'
import { sceneNames } from './names.ts'
import PieceRow from './PieceRow.svelte'
import { actionPiece, actionWords } from './pieces/actions.ts'
import { conditionPiece, conditionWords } from './pieces/conditions.ts'
import { ruleActions, ruleConditions } from './rule-menu.ts'
import type { SchematicSession } from './schematic-session.svelte.ts'

const { session }: { session: SchematicSession } = $props()
const def = $derived(session.def)
// A rule has no character of its own, so a mode it names is any of the scene's.
const names = $derived.by(() => {
  const scene = sceneNames(session, -1)
  return def === undefined || scene === undefined
    ? undefined
    : { ...scene, modes: [...new Set(def.agents.flatMap((a) => a.modes))] }
})
const conditions = $derived(def === undefined || names === undefined ? [] : ruleConditions(def, names))
const actions = $derived(def === undefined || names === undefined ? [] : ruleActions(def, names))
const set = (rule: number, label: string, next: NonNullable<typeof def>['rules'][number]): void =>
  void session.setRule(label, rule, next)
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
          <FieldRow label="What it is for" kind="text" value={rule.text} onchange={(next) => set(r, 'Change a rule', { ...rule, text: String(next) })} />
          {#if rule.every !== undefined}
            <FieldRow label="Every" kind="number" unit="s" min={0.1} max={3600} step={0.5} value={rule.every} onchange={(next) => set(r, 'Change a rule', { ...rule, every: Number(next) })} />
          {/if}
          <h3>It happens when</h3>
          <ul>
            {#each rule.when as probe, i (i)}
              <PieceRow
                piece={conditionPiece(probe)}
                value={probe}
                {names}
                fallback={conditionWords(probe, names)}
                onwrite={(next: Probe) => set(r, 'Change a condition', { ...rule, when: rule.when.map((p, j) => (j === i ? next : p)) })}
                onremove={() => set(r, 'Remove a condition', { ...rule, when: rule.when.filter((_, j) => j !== i) })}
              />
            {/each}
          </ul>
          <AddPiece label="Add a condition" pieces={conditions} {names} onadd={(probe: Probe) => set(r, 'Add a condition', { ...rule, when: [...rule.when, probe] })} />
          <h3>Then</h3>
          <ul>
            {#each rule.then as effect, i (i)}
              <PieceRow
                piece={actionPiece(effect)}
                value={effect}
                {names}
                fallback={actionWords(effect, names)}
                onwrite={(next: SysEffect) => set(r, 'Change an action', { ...rule, then: rule.then.map((e, j) => (j === i ? next : e)) })}
                onremove={() => set(r, 'Remove an action', { ...rule, then: rule.then.filter((_, j) => j !== i) })}
              />
            {/each}
          </ul>
          <AddPiece label="Add an action" pieces={actions} {names} onadd={(effect: SysEffect) => set(r, 'Add an action', { ...rule, then: [...rule.then, effect] })} />
          <Button onclick={() => void session.removeRule(r)}>Remove this rule</Button>
        </li>
      {/each}
    </ul>
    <Button onclick={() => void session.addRule()}>Add a rule</Button>
  {/if}
  <!-- The design table (`objects`, `matrix`) is notes for people. It is in the file and changes no behaviour. -->
  <p class="dim">Design notes, kept in the file. They change no behaviour, so they are not edited here.</p>
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
