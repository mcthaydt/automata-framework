<!--
  The scene's puzzle: its items, its facts with their starting values, its actions as sentences ("At the shutter, using the
  crank: when …, …") and its goal. How the characters open the way and what can kill the player are shown as sentences and
  not changed here. "Can it be finished?" asks the solver, in a worker, about the puzzle as it is now.
-->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import type { Action, Cond, Effect, Value } from '@automata/puzzle/sim'
import { onDestroy } from 'svelte'
import FieldRow from '../../shared/ui/FieldRow.svelte'
import AddPiece from './AddPiece.svelte'
import PieceRow from './PieceRow.svelte'
import { type Names, spaced, valueFrom, valueWords } from './pieces/piece.ts'
import { puzzleNames } from './puzzle/puzzle-edits.ts'
import {
  PUZZLE_CONDITIONS,
  PUZZLE_EFFECTS,
  puzzleCondPiece,
  puzzleCondWords,
  puzzleEffectPiece,
  puzzleEffectWords,
} from './puzzle/puzzle-pieces.ts'
import type { PuzzleAnswer } from './puzzle/solve.ts'
import { createFinishChecker, type FinishChecker } from './puzzle/solver-client.ts'
import { diffEdits, sameShape } from './schematic-edits.ts'
import type { SchematicSession } from './schematic-session.svelte.ts'

const { session, checker = createFinishChecker() }: { session: SchematicSession; checker?: FinishChecker } =
  $props()

const def = $derived(session.puzzleDef)
const names: Names | undefined = $derived(def === undefined ? undefined : puzzleNames(def))
const text = $derived(session.puzzleText)
const SPECIAL = [
  { value: 'floor', label: 'the floor' },
  { value: 'combine', label: 'two things together' },
  { value: 'code', label: 'the keypad' },
]

let answer = $state<{ readonly answer: PuzzleAnswer; readonly text: string | undefined } | undefined>()
let asking = $state(false)
let newItem = $state('')
let newFact = $state('')

async function ask(): Promise<void> {
  if (def === undefined || asking) return
  asking = true
  const asked = text
  const result = await checker.ask(JSON.parse(JSON.stringify(def)))
  answer = { answer: result, text: asked }
  asking = false
}
onDestroy(() => checker.stop())

const spots = (n: Names): { value: string; label: string }[] => [
  ...n.places.map((value) => ({ value, label: `the ${spaced(value)}` })),
  ...SPECIAL,
]
const usingChoices = (n: Names, current: string): { value: string; label: string }[] => [
  { value: '', label: 'nothing' },
  ...(n.items ?? []).map((value) => ({ value, label: `the ${spaced(value)}` })),
  ...(current !== '' && !(n.items ?? []).includes(current)
    ? [{ value: current, label: spaced(current) }]
    : []),
]

function setAction(index: number, label: string, next: Action): void {
  const before = def?.actions[index]
  if (before === undefined) return
  if (sameShape(before, next)) void session.puzzleEdit(label, diffEdits(['actions', index], before, next))
  else void session.puzzleList(label, 'actions', { kind: 'replace', index, next })
}
function setGoal(index: number, label: string, next: Cond): void {
  const before = def?.goal[index]
  if (before === undefined) return
  if (sameShape(before, next)) void session.puzzleEdit(label, diffEdits(['goal', index], before, next))
  else void session.puzzleList(label, 'goal', { kind: 'replace', index, next })
}
const not = (cond: Cond): Cond => ('not' in cond ? cond.not : { not: cond })

function addAction(): void {
  if (def === undefined) return
  let n = def.actions.length + 1
  while (def.actions.some((a) => a.id === `action-${n}`)) n += 1
  const at = Object.keys(def.hotspots)[0] ?? 'floor'
  void session.puzzleList('Add an action', 'actions', {
    kind: 'add',
    next: { id: `action-${n}`, at, then: [], say: 'Nothing happens.' },
  })
}
</script>

<section class="puzzle" aria-label="Puzzle">
  <h2>Puzzle</h2>
  {#if def === undefined || names === undefined}
    <p class="dim">This scene’s puzzle file has a mistake, so it is read only until the mistake is fixed.</p>
  {:else}
    <h3>Things the player can carry</h3>
    <ul class="chips">
      {#each def.items as item (item)}
        <li><span>{spaced(item)}</span> <Button onclick={() => void session.removePuzzleItem(item)} aria-label={`Remove item: ${spaced(item)}`}>Remove</Button></li>
      {/each}
    </ul>
    <div class="adder">
      <label><span>New item</span><input bind:value={newItem} /></label>
      <Button onclick={() => void session.addPuzzleItem(newItem).then((o) => { if (o.ok) newItem = '' })}>Add an item</Button>
    </div>

    <h3>What can be true</h3>
    <ul>
      {#each Object.entries(def.facts) as [fact, start] (fact)}
        <li class="card">
          <FieldRow
            label={`“${spaced(fact)}” starts as`}
            kind={typeof start === 'number' ? 'number' : typeof start === 'boolean' ? 'choice' : 'text'}
            value={typeof start === 'boolean' ? (start ? 'yes' : 'no') : start}
            options={typeof start === 'boolean' ? [{ value: 'yes', label: 'yes' }, { value: 'no', label: 'no' }] : undefined}
            min={typeof start === 'number' ? -1000 : undefined}
            max={typeof start === 'number' ? 1000 : undefined}
            step={typeof start === 'number' ? 1 : undefined}
            onchange={(next) => void session.puzzleEdit('Change where a fact starts', [{ keyPath: ['facts', fact], expected: start, set: valueFrom(start, next) }])}
          />
          <Button onclick={() => void session.removePuzzleFact(fact)} aria-label={`Remove fact: ${spaced(fact)}`}>Remove</Button>
        </li>
      {/each}
    </ul>
    <div class="adder">
      <label><span>New fact</span><input bind:value={newFact} /></label>
      <Button onclick={() => void session.addPuzzleFact(newFact).then((o) => { if (o.ok) newFact = '' })}>Add a fact</Button>
    </div>

    <h3>What the player can do</h3>
    {#if def.actions.length === 0}<p class="dim">Nothing yet. Add the first thing the player can do.</p>{/if}
    <ul>
      {#each def.actions as action, i (action.id)}
        <li class="card">
          <p class="sentence">
            At {action.at === 'floor' ? 'the floor' : action.at === 'combine' ? 'two things together' : action.at === 'code' ? 'the keypad' : `the ${spaced(action.at)}`}{Array.isArray(action.use) ? `, using the ${spaced(action.use[0])} and the ${spaced(action.use[1])}` : typeof action.use === 'string' ? `, using the ${spaced(action.use)}` : ''}:
            {(action.when ?? []).length === 0 ? 'always' : `when ${(action.when ?? []).map((c) => puzzleCondWords(c, names)).join(' and ')}`},
            {action.then.length === 0 ? 'nothing happens' : action.then.map((e) => puzzleEffectWords(e, names)).join(', ')}
          </p>
          <FieldRow label="Where" kind="choice" value={action.at} options={spots(names)} onchange={(next) => setAction(i, 'Change where an action happens', { ...action, at: String(next) })} />
          {#if !Array.isArray(action.use)}
            {@const using = typeof action.use === 'string' ? action.use : ''}
            <FieldRow
              label="Using"
              kind="choice"
              value={using}
              options={usingChoices(names, using)}
              onchange={(next) => {
                const { use: _gone, ...rest } = action
                setAction(i, 'Change what an action uses', next === '' ? rest : { ...rest, use: String(next) })
              }}
            />
          {/if}
          <FieldRow label="What the player is told" kind="text" value={action.say} onchange={(next) => setAction(i, 'Change what is said', { ...action, say: String(next) })} />
          <h4>It happens when</h4>
          <ul>
            {#each action.when ?? [] as cond, c (c)}
              <PieceRow
                piece={puzzleCondPiece(cond)}
                value={cond}
                {names}
                fallback={puzzleCondWords(cond, names)}
                negated={'not' in cond}
                onnot={() => setAction(i, 'Turn a condition round', { ...action, when: (action.when ?? []).map((x, j) => (j === c ? not(x) : x)) })}
                onwrite={(next: Cond) => setAction(i, 'Change a condition', { ...action, when: (action.when ?? []).map((x, j) => (j === c ? next : x)) })}
                onremove={() => {
                  const rest = (action.when ?? []).filter((_, j) => j !== c)
                  const { when: _gone, ...others } = action
                  setAction(i, 'Remove a condition', rest.length === 0 ? others : { ...others, when: rest })
                }}
              />
            {/each}
          </ul>
          <AddPiece label="Add a condition" pieces={PUZZLE_CONDITIONS} {names} onadd={(cond: Cond) => setAction(i, 'Add a condition', { ...action, when: [...(action.when ?? []), cond] })} />
          <h4>Then</h4>
          <ul>
            {#each action.then as effect, e (e)}
              <PieceRow
                piece={puzzleEffectPiece(effect)}
                value={effect}
                {names}
                fallback={puzzleEffectWords(effect, names)}
                onwrite={(next: Effect) => setAction(i, 'Change an effect', { ...action, then: action.then.map((x, j) => (j === e ? next : x)) })}
                onremove={() => setAction(i, 'Remove an effect', { ...action, then: action.then.filter((_, j) => j !== e) })}
              />
            {/each}
          </ul>
          <AddPiece label="Add an effect" pieces={PUZZLE_EFFECTS} {names} onadd={(effect: Effect) => setAction(i, 'Add an effect', { ...action, then: [...action.then, effect] })} />
          <Button onclick={() => void session.puzzleList('Remove an action', 'actions', { kind: 'remove', index: i })} aria-label={`Remove action: ${spaced(action.id)}`}>Remove this action</Button>
        </li>
      {/each}
    </ul>
    <Button onclick={addAction}>Add an action</Button>

    <h3>The goal</h3>
    <p class="dim">The puzzle is done when all of these are true.</p>
    <ul>
      {#each def.goal as cond, g (g)}
        <PieceRow
          piece={puzzleCondPiece(cond)}
          value={cond}
          {names}
          fallback={puzzleCondWords(cond, names)}
          negated={'not' in cond}
          onnot={() => setGoal(g, 'Turn a condition round', not(cond))}
          onwrite={(next: Cond) => setGoal(g, 'Change the goal', next)}
          onremove={() => void session.puzzleList('Remove from the goal', 'goal', { kind: 'remove', index: g })}
        />
      {/each}
    </ul>
    <AddPiece label="Add to the goal" pieces={PUZZLE_CONDITIONS} {names} onadd={(cond: Cond) => void session.puzzleList('Add to the goal', 'goal', { kind: 'add', next: cond })} />

    {#if def.systemic.length > 0}
      <h3>How the characters open the way</h3>
      <ul>
        {#each def.systemic as way (way.id)}
          <li class="card"><p class="sentence">{way.note}</p><p class="dim">Once {way.enables.map((c) => puzzleCondWords(c, names)).join(' and ')}.{way.risk === undefined ? '' : ` It is ${way.risk === 'lethal' ? 'deadly' : 'a chase'}.`}</p></li>
        {/each}
      </ul>
    {/if}
    {#if def.lethal.length > 0}
      <h3>What can kill the player</h3>
      <ul>
        {#each def.lethal as rule (rule.id)}
          <li class="card"><p class="sentence">{rule.rule}</p></li>
        {/each}
      </ul>
    {/if}

    <h3>Can it be finished?</h3>
    <Button variant="primary" disabled={asking} onclick={() => void ask()}>{asking ? 'Working it out…' : 'Can it be finished?'}</Button>
    {#if answer !== undefined}
      <div class="result" data-stale={answer.text !== text}>
        <p class="sentence" role="status">{answer.answer.words}</p>
        {#if answer.text !== text}<p class="dim">This is from before your last change. Ask again.</p>{/if}
      </div>
    {/if}
  {/if}
</section>

<style>
  .puzzle {
    display: grid;
    gap: var(--space-3);
  }
  h2 {
    margin: 0;
    color: var(--color-text-primary);
    font: var(--text-title-15);
  }
  h3,
  h4 {
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
  .chips li,
  .card,
  .result {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-surface);
  }
  .chips li {
    grid-template-columns: 1fr auto;
    align-items: center;
  }
  .adder {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: end;
  }
  .adder label {
    display: grid;
    gap: var(--space-1);
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .adder input {
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .result[data-stale='true'] {
    opacity: 0.55;
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
