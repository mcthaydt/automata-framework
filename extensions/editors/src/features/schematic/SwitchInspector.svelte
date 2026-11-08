<!--
  One switch, in words: which mode it leaves and which it goes to, what must be true, what happens, and where it comes in
  the order the game checks them. Every change is one undo step.
-->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import type { AgentDef, Probe, SysEffect, Transition } from '@automata/systems/sim'
import AddPiece from './AddPiece.svelte'
import { ANY_MODE, timingOf } from './diagram/layout.ts'
import PieceRow from './PieceRow.svelte'
import { ACTIONS, actionPiece, actionWords } from './pieces/actions.ts'
import { CONDITIONS, conditionPiece, conditionWords } from './pieces/conditions.ts'
import { modeWords, type Names } from './pieces/piece.ts'
import {
  withAction,
  withCondition,
  withNotToggled,
  withoutAction,
  withoutCondition,
} from './schematic-edits.ts'
import type { SchematicSession } from './schematic-session.svelte.ts'
import { fromWords, groupOf, switchWords } from './switch-words.ts'

interface Props {
  session: SchematicSession
  agent: number
  character: AgentDef
  index: number
  names: Names
}

const { session, agent, character, index, names }: Props = $props()
const t = $derived(character.transitions[index])
const group = $derived(t === undefined ? [] : groupOf(character, timingOf(t.when)))
const place = $derived(group.indexOf(index))

const modeChoices = $derived(character.modes.map((mode) => ({ value: mode, label: modeWords(mode) })))
const fromChoices = $derived([{ value: ANY_MODE, label: fromWords(ANY_MODE) }, ...modeChoices])

const set = (label: string, next: Transition): void => void session.setSwitch(label, agent, index, next)
</script>

{#if t !== undefined}
  <section class="inspector" aria-label="Switch">
    <h3>{switchWords(t, names)}</h3>

    <div class="pair">
      <label>
        <span>From</span>
        <select value={t.from} onchange={(e) => set('Change where it comes from', { ...t, from: e.currentTarget.value })}>
          {#each fromChoices as c (c.value)}<option value={c.value}>{c.label}</option>{/each}
        </select>
      </label>
      <label>
        <span>To</span>
        <select value={t.to} onchange={(e) => set('Change where it goes', { ...t, to: e.currentTarget.value })}>
          {#each modeChoices as c (c.value)}<option value={c.value}>{c.label}</option>{/each}
        </select>
      </label>
    </div>

    <h4>It happens when</h4>
    {#if t.when.length === 0}<p class="dim">Always. Add a condition to make it wait.</p>{/if}
    <ul>
      {#each t.when as probe, i (i)}
        <PieceRow
          piece={conditionPiece(probe)}
          value={probe}
          {names}
          fallback={conditionWords(probe, names)}
          negated={'not' in probe}
          onnot={() => set('Turn a condition round', withNotToggled(t, i))}
          onwrite={(next: Probe) => set('Change a condition', { ...t, when: t.when.map((p, j) => (j === i ? next : p)) })}
          onremove={() => set('Remove a condition', withoutCondition(t, i))}
        />
      {/each}
    </ul>
    <AddPiece label="Add a condition" pieces={CONDITIONS} {names} onadd={(probe: Probe) => set('Add a condition', withCondition(t, probe))} />

    <h4>Then</h4>
    {#if (t.do ?? []).length === 0}<p class="dim">It only changes mode. Add an action to make something happen.</p>{/if}
    <ul>
      {#each t.do ?? [] as effect, i (i)}
        <PieceRow
          piece={actionPiece(effect)}
          value={effect}
          {names}
          fallback={actionWords(effect, names)}
          onwrite={(next: SysEffect) => set('Change an action', { ...t, do: (t.do ?? []).map((e, j) => (j === i ? next : e)) })}
          onremove={() => set('Remove an action', withoutAction(t, i))}
        />
      {/each}
    </ul>
    <AddPiece label="Add an action" pieces={ACTIONS} {names} onadd={(effect: SysEffect) => set('Add an action', withAction(t, effect))} />

    <h4>Order</h4>
    <p class="dim">
      When more than one can happen, the one nearer the top of its list goes first. This one is number {place + 1} of {group.length}.
    </p>
    <div class="buttons">
      <Button disabled={place <= 0} onclick={() => void session.moveSwitch(agent, index, place - 1)}>Check earlier</Button>
      <Button disabled={place < 0 || place >= group.length - 1} onclick={() => void session.moveSwitch(agent, index, place + 1)}>Check later</Button>
      <Button variant="danger" onclick={() => void session.removeSwitch(agent, index)}>Remove this switch</Button>
    </div>
  </section>
{/if}

<style>
  .inspector {
    display: grid;
    gap: var(--space-3);
  }
  h3 {
    margin: 0;
    color: var(--color-text-primary);
    font: var(--text-title-15);
  }
  h4 {
    margin: var(--space-2) 0 0;
    color: var(--color-text-dim);
    font: var(--text-body-13-medium);
  }
  ul {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
  }
  .pair {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: var(--space-3);
  }
  label {
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
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
