<!--
  The chosen feel as sentences: "When player hit happens", then each effect with its fields ("Shake the screen, how
  hard 0.3"). A missing file offers to start one; a file with a mistake opens read only and says where the mistake is.
-->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import { type FeelEntry, resolveLimits } from '@automata/feel'
import EventPicker from '../../shared/ui/EventPicker.svelte'
import FieldRow from '../../shared/ui/FieldRow.svelte'
import FeelPlayer from './FeelPlayer.svelte'
import {
  addEffectEdit,
  answerEdit,
  EFFECT_KINDS,
  type EffectField,
  type EffectKind,
  type EffectLine,
  effectLines,
  eventWords,
  feelProblemWords,
  fieldChange,
  limitEdit,
  limitLines,
  limitNote,
  removeEffectEdit,
  removeFeelEdit,
  springEdit,
  springLines,
  subjectNote,
} from './feel-model.ts'
import type { FeelSession } from './feel-session.svelte.ts'

const { session }: { session: FeelSession } = $props()
let choosing = $state(false)
let removing = $state(false)
let changing = $state(false)

const read = $derived(session.read)
const content = $derived(session.content)
const entries = $derived(content?.entry ?? [])
const index = $derived(typeof session.chosen === 'number' ? session.chosen : undefined)
const entry = $derived(index === undefined ? undefined : entries[index])
const problems = $derived(read.kind === 'invalid' ? read.problems : [])

/** The problem at one key path under the chosen feel, in words. */
function problemAt(...keys: readonly (string | number)[]): string | undefined {
  if (index === undefined) return undefined
  const path = ['entry', index, ...keys]
  const found = problems.find(
    (problem) =>
      problem.keyPath.length === path.length && problem.keyPath.every((key, at) => key === path[at]),
  )
  return found === undefined ? undefined : feelProblemWords(found, entries)
}

function rowOf(chosen: FeelEntry, line: EffectLine): Record<string, unknown> {
  return (chosen[line.channel]?.[line.index] ?? {}) as Record<string, unknown>
}

async function setField(chosen: FeelEntry, line: EffectLine, field: EffectField, value: number | string) {
  if (index === undefined) return
  const edit = fieldChange(index, line, field, rowOf(chosen, line)[field.key], value)
  if (edit === undefined) return
  await session.change(
    `${line.words}: ${field.label.toLowerCase()}`,
    [edit],
    `${index}.${line.channel}.${line.index}.${field.key}`,
  )
}

async function addEffect(chosen: FeelEntry, kind: EffectKind, words: string) {
  if (index === undefined) return
  const outcome = await session.change(`Add ${words.toLowerCase()}`, [
    addEffectEdit(chosen, index, kind, session.cues),
  ])
  if (outcome.ok) choosing = false
}

async function answer(chosen: FeelEntry, on: string) {
  if (index === undefined || on === chosen.on) {
    changing = false
    return
  }
  const outcome = await session.change(`Answer ${eventWords(on)} instead`, [answerEdit(index, chosen.on, on)])
  if (outcome.ok) changing = false
}

async function removeFeel(chosen: FeelEntry) {
  if (index === undefined) return
  const outcome = await session.change(`Remove the feel for ${eventWords(chosen.on)}`, [
    removeFeelEdit(index),
  ])
  if (!outcome.ok) return
  removing = false
  session.chosen = Math.max(0, index - 1)
}
</script>

<section class="canvas" aria-label="Feel">
  {#if session.message !== undefined}
    <p class="refused" role="alert">{session.message}</p>
  {/if}
  <div class="split">
  <div class="sentences">

  {#if read.kind === 'missing'}
    <div class="empty">
      <h2>This game has no feel file yet.</h2>
      <p>A feel file says what the player feels when something happens: a shake, a freeze, a flash, a rumble.</p>
      <Button variant="primary" onclick={() => void session.start()}>Start a feel file</Button>
    </div>
  {:else if read.kind === 'syntax'}
    <div class="empty">
      <h2>The feel file has a mistake{read.line === undefined ? '' : ` on line ${String(read.line)}`}.</h2>
      <p>It opens read only until the mistake is fixed. Your file is unchanged.</p>
    </div>
  {:else if session.chosen === 'limits' && content !== undefined}
    <h2>Never more than</h2>
    <p class="lead">Every effect is held to these, so a strong shake never makes anyone feel sick.</p>
    <div class="fields">
      {#each limitLines(content) as limit (limit.key)}
        <FieldRow
          label={limit.label}
          kind="number"
          value={limit.value}
          unit={limit.unit}
          min={limit.min}
          max={limit.max}
          step={limit.step}
          onchange={(value) =>
            void session.change(`${limit.label}`, [limitEdit(content, limit.key, Number(value))], `limits.${limit.key}`)}
        />
      {/each}
    </div>
    <h2>How squash moves</h2>
    <p class="lead">A squashed character springs back like jelly. Speed is how fast, Wobble how much it jiggles, Wind-up how far it dips first.</p>
    <div class="fields">
      {#each springLines(content) as line (line.key)}
        <FieldRow
          label={line.label}
          kind="number"
          value={line.value}
          min={line.min}
          max={line.max}
          step={line.step}
          onchange={(value) =>
            void session.change(line.label, [springEdit(content, line.key, Number(value))], `springs.squash.${line.key}`)}
        />
      {/each}
    </div>
  {:else if entry === undefined}
    <div class="empty">
      <h2>Nothing has a feel yet.</h2>
      <p>Add one for something that happens in your game, like the player getting hit.</p>
    </div>
  {:else}
    <h2>When {eventWords(entry.on)} happens</h2>
    {#if changing}
      <EventPicker
        events={session.events}
        answered={new Set(entries.map((other) => other.on))}
        addLabel="Use this"
        onpick={(on) => void answer(entry, on)}
        oncancel={() => (changing = false)}
      />
    {:else}
      <p class="note">
        Answers: {eventWords(entry.on)}
        <Button variant="quiet" onclick={() => (changing = true)}>Change</Button>
      </p>
    {/if}
    {#if problemAt('on') !== undefined}<p class="refused" role="alert">{problemAt('on')}</p>{/if}
    {#each effectLines(entry, resolveLimits(content ?? {}), session.cues) as line (`${line.channel}.${String(line.index)}`)}
      <article class="effect" aria-label={line.words}>
        <header>
          <h3>{line.words}</h3>
          <Button
            variant="quiet"
            aria-label={`Remove ${line.words.toLowerCase()}`}
            onclick={() => void session.change(`Remove ${line.words.toLowerCase()}`, [removeEffectEdit(index ?? 0, line)])}
          >
            Remove
          </Button>
        </header>
        <div class="fields">
          {#each line.fields as field (field.key)}
            {@const note = content === undefined ? undefined : limitNote(content, line, field.key)}
            <FieldRow
              label={field.label}
              kind={field.kind}
              value={field.value}
              options={field.kind === 'choice' ? field.options : undefined}
              unit={field.kind === 'number' ? field.unit : undefined}
              min={field.kind === 'number' ? field.min : undefined}
              max={field.kind === 'number' ? field.max : undefined}
              step={field.kind === 'number' ? field.step : undefined}
              problem={problemAt(line.channel, line.index, field.key) ?? problemAt(line.channel, line.index)}
              onchange={(value) => void setField(entry, line, field, value)}
            />
            {#if note !== undefined}<p class="note" role="status">{note}</p>{/if}
            {#if line.channel === 'audio' && field.key === 'cue' && !session.cues.includes(String(field.value))}
              <p class="note">The game has no sound “{field.value}” yet.</p>
            {/if}
            {#if field.hint !== undefined}<p class="note">{field.hint}</p>{/if}
            {#if line.channel === 'pose' || line.channel === 'visual'}
              {@const said = subjectNote(line, session.events.some((event) => event.id === entry.on && event.noSubject))}
              {#if said !== undefined && field.key === line.fields[0]?.key}<p class="note" role="status">{said}</p>{/if}
            {/if}
          {/each}
        </div>
      </article>
    {:else}
      <p class="lead">Nothing happens yet. Add an effect the player will feel.</p>
    {/each}

    {#if choosing}
      <div class="choices" role="group" aria-label="Add an effect">
        {#each EFFECT_KINDS as choice (choice.kind)}
          <Button disabled={session.adding} onclick={() => void addEffect(entry, choice.kind, choice.words)}
            >{choice.words}</Button
          >
        {/each}
        <Button variant="quiet" onclick={() => (choosing = false)}>Cancel</Button>
      </div>
    {:else}
      <div class="actions">
        <Button variant="primary" disabled={session.adding} onclick={() => (choosing = true)}>Add an effect</Button>
        {#if removing}
          <span class="confirm" role="group" aria-label="Remove this feel?">
            Remove this feel?
            <Button variant="danger" onclick={() => void removeFeel(entry)}>Remove</Button>
            <Button variant="quiet" onclick={() => (removing = false)}>Keep it</Button>
          </span>
        {:else}
          <Button variant="quiet" onclick={() => (removing = true)}>Remove this feel</Button>
        {/if}
      </div>
    {/if}
  {/if}
  </div>
  {#if read.kind === 'syntax'}
    <p class="lead" style="grid-area: stage">Fix the file to play it.</p>
  {:else if read.kind !== 'missing' && index !== undefined && entry !== undefined}
    <FeelPlayer {session} />
  {/if}
  </div>
</section>

<style>
  .note {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  /* A page of sentences, not a stage: it fills the canvas region with the app's paper so the text tokens read. */
  .canvas {
    display: grid;
    align-content: start;
    grid-template-columns: minmax(0, 1fr);
    container-type: inline-size;
    gap: var(--space-4);
    box-sizing: border-box;
    height: 100%;
    padding: var(--space-5);
    overflow-y: auto;
    background: var(--color-bg-app);
  }
  /* Stacked: the stage first, then the sentences, then what the player sets. */
  .split {
    display: grid;
    align-content: start;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'stage' 'sentences' 'settings';
    gap: var(--space-4);
    min-width: 0;
  }
  .sentences {
    grid-area: sentences;
    display: grid;
    align-content: start;
    gap: var(--space-4);
    min-width: 0;
    max-width: 40rem;
  }
  /* Beside each other when the canvas is wide enough for both, stacked (the stage first) when it is not. */
  @container (min-width: 560px) {
    .split {
      grid-template-columns: minmax(0, 1fr) minmax(0, 18rem);
      grid-template-areas: 'sentences stage' 'sentences settings';
      grid-template-rows: auto 1fr;
      align-items: start;
    }
  }
  h2 {
    margin: 0;
    color: var(--color-text-primary);
    font: var(--text-title-15);
  }
  h3 {
    margin: 0;
    color: var(--color-text-primary);
    font: var(--text-body-13-medium);
  }
  .lead,
  .empty p {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .empty {
    display: grid;
    justify-items: start;
    gap: var(--space-3);
  }
  .effect {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-md);
    background: var(--color-bg-surface);
  }
  .effect header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .fields {
    display: grid;
    gap: var(--space-3);
  }
  .choices,
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .confirm {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .refused {
    margin: 0;
    color: var(--color-state-bad);
    font: var(--text-body-13);
  }
</style>
