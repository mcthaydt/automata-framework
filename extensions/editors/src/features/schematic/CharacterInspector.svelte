<!-- The character itself, with nothing else selected: its name, where it starts, what it notices and its patrol. -->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import type { AgentDef, RoutineStop, Sense, SysEffect } from '@automata/systems/sim'
import FieldRow from '../../shared/ui/FieldRow.svelte'
import AddPiece from './AddPiece.svelte'
import PieceRow from './PieceRow.svelte'
import { freshStop, startWords, stopFields, withoutStopAction, withStopAction, writeStop } from './patrol.ts'
import { ACTIONS, actionPiece, actionWords } from './pieces/actions.ts'
import { modeWords, type Names } from './pieces/piece.ts'
import type { SchematicSession } from './schematic-session.svelte.ts'
import {
  freshSense,
  missingSenses,
  senseFields,
  senseKind,
  senseWords,
  TWO_D_LINT,
  withWarmthSource,
  writeSense,
} from './senses.ts'

interface Props {
  session: SchematicSession
  agent: number
  character: AgentDef
  names: Names
}

const { session, agent, character, names }: Props = $props()
const stops = $derived(character.routine ?? [])
const missing = $derived(missingSenses(character.senses))

const setSense = (i: number, next: Sense): void =>
  void session.setItem('Change what it notices', 'senses', agent, i, next)
const setStop = (i: number, next: RoutineStop): void =>
  void session.setItem('Change the patrol', 'routine', agent, i, next)

/** Swaps stop `i` with the one `by` places away, as one undo step. */
function moveStop(i: number, by: number): void {
  const a = stops[i]
  const b = stops[i + by]
  if (a === undefined || b === undefined) return
  void session.changeLists('Change the patrol order', [
    { kind: 'replace', list: 'routine', agent, index: i, next: b },
    { kind: 'replace', list: 'routine', agent, index: i + by, next: a },
  ])
}
</script>

<section class="inspector" aria-label="Character">
  <h3>{modeWords(character.id)}</h3>
  <FieldRow label="Name" kind="text" value={character.id} onchange={(next) => void session.renameCharacter(character.id, String(next))} />
  <p class="line"><strong>Starts at:</strong> {startWords(character)}</p>

  <h4>What it notices</h4>
  {#if character.senses.length === 0}<p class="dim">Nothing yet. It cannot notice the player.</p>{/if}
  <ul>
    {#each character.senses as sense, i (senseKind(sense))}
      <li class="card">
        <p class="sentence">{senseWords(sense)}</p>
        {#each senseFields(sense) as field (field.key)}
          <FieldRow
            label={field.label}
            kind={field.kind}
            value={field.value}
            options={field.kind === 'choice' ? field.options : undefined}
            unit={field.kind === 'number' ? field.unit : undefined}
            min={field.kind === 'number' ? field.min : undefined}
            max={field.kind === 'number' ? field.max : undefined}
            step={field.kind === 'number' ? field.step : undefined}
            onchange={(next) => setSense(i, writeSense(sense, field.key, next))}
          />
        {/each}
        {#if ('warmth' in sense)}
          <Button onclick={() => setSense(i, withWarmthSource(sense, `thing-${Object.keys(sense.warmth.sources).length + 1}`))}>Add a warm thing</Button>
        {/if}
        {#if session.facts.twoD && ('light' in sense || 'warmth' in sense)}<p class="dim">{TWO_D_LINT}</p>{/if}
        <Button aria-label={`Remove: ${senseWords(sense)}`} onclick={() => void session.changeList('Remove a sense', { kind: 'remove', list: 'senses', agent, index: i })}>Remove</Button>
      </li>
    {/each}
  </ul>
  {#if missing.length > 0}
    <label class="add">
      <span>Add a sense</span>
      <select
        value=""
        onchange={(event) => {
          const kind = missing.find((m) => m.kind === event.currentTarget.value)?.kind
          event.currentTarget.value = ''
          if (kind !== undefined) void session.changeList('Add a sense', { kind: 'add', list: 'senses', agent, next: freshSense(kind) })
        }}
      >
        <option value="">Choose…</option>
        {#each missing as entry (entry.kind)}<option value={entry.kind}>{entry.menu}</option>{/each}
      </select>
    </label>
  {/if}

  <h4>Patrol</h4>
  {#if names.places.length === 0}
    <p class="dim">Characters need places to walk between. Add the first place.</p>
  {:else}
    {#if stops.length === 0}<p class="dim">No stops yet. Add one and it walks between its stops, in order.</p>{/if}
    <ol>
      {#each stops as stop, i (i)}
        <li class="card">
          <p class="sentence">Stop {i + 1}</p>
          {#each stopFields(stop, names.places) as field (field.key)}
            <FieldRow
              label={field.label}
              kind={field.kind}
              value={field.value}
              options={field.kind === 'choice' ? field.options : undefined}
              unit={field.kind === 'number' ? field.unit : undefined}
              min={field.kind === 'number' ? field.min : undefined}
              max={field.kind === 'number' ? field.max : undefined}
              step={field.kind === 'number' ? field.step : undefined}
              onchange={(next) => setStop(i, writeStop(stop, field.key, next))}
            />
          {/each}
          <ul>
            {#each stop.do ?? [] as effect, j (j)}
              <PieceRow
                piece={actionPiece(effect)}
                value={effect}
                {names}
                fallback={actionWords(effect, names)}
                onwrite={(next: SysEffect) => setStop(i, { ...stop, do: (stop.do ?? []).map((e, k) => (k === j ? next : e)) })}
                onremove={() => setStop(i, withoutStopAction(stop, j))}
              />
            {/each}
          </ul>
          <AddPiece label="Add something it does here" pieces={ACTIONS} {names} onadd={(effect: SysEffect) => setStop(i, withStopAction(stop, effect))} />
          <div class="buttons">
            <Button disabled={i === 0} onclick={() => moveStop(i, -1)} aria-label={`Move stop ${i + 1} earlier`}>Earlier</Button>
            <Button disabled={i === stops.length - 1} onclick={() => moveStop(i, 1)} aria-label={`Move stop ${i + 1} later`}>Later</Button>
            <Button aria-label={`Remove stop ${i + 1}`} onclick={() => void session.changeList('Remove a stop', { kind: 'remove', list: 'routine', agent, index: i })}>Remove</Button>
          </div>
        </li>
      {/each}
    </ol>
    <Button onclick={() => void session.changeList('Add a stop', { kind: 'add', list: 'routine', agent, next: freshStop(names.places, character.routine) })}>Add a stop</Button>
  {/if}
</section>

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
  ul,
  ol {
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
  .sentence,
  .line {
    margin: 0;
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
  .add {
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
</style>
