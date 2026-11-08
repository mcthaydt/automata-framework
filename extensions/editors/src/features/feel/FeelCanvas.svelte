<!--
  The chosen feel as sentences: "When player hit happens", then each effect with its fields ("Shake the screen, how
  hard 0.3"). A missing file offers to start one; a file with a mistake opens read only and says where the mistake is.
-->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import type { FeelEntry } from '@automata/feel'
import FieldRow from '../../shared/ui/FieldRow.svelte'
import {
  addEffectEdit,
  EFFECT_KINDS,
  type EffectKind,
  type EffectLine,
  effectLines,
  eventWords,
  feelProblemWords,
  fieldEdit,
  limitEdit,
  limitLines,
  removeEffectEdit,
  removeFeelEdit,
} from './feel-model.ts'
import type { FeelSession } from './feel-session.svelte.ts'

const { session }: { session: FeelSession } = $props()
let choosing = $state(false)
let removing = $state(false)

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

async function setField(
  chosen: FeelEntry,
  line: EffectLine,
  key: string,
  label: string,
  value: number | string,
) {
  if (index === undefined) return
  const before = rowOf(chosen, line)[key]
  const edit =
    before === undefined
      ? { keyPath: ['entry', index, line.channel, line.index, key], insert: value }
      : fieldEdit(index, line, key, before, value)
  await session.change(
    `${line.words}: ${label.toLowerCase()}`,
    [edit],
    `${index}.${line.channel}.${line.index}.${key}`,
  )
}

async function addEffect(chosen: FeelEntry, kind: EffectKind, words: string) {
  if (index === undefined) return
  const outcome = await session.change(`Add ${words.toLowerCase()}`, [addEffectEdit(chosen, index, kind)])
  if (outcome.ok) choosing = false
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
  {:else if entry === undefined}
    <div class="empty">
      <h2>Nothing has a feel yet.</h2>
      <p>Add one for something that happens in your game, like the player getting hit.</p>
    </div>
  {:else}
    <h2>When {eventWords(entry.on)} happens</h2>
    {#if problemAt('on') !== undefined}<p class="refused" role="alert">{problemAt('on')}</p>{/if}
    {#each effectLines(entry) as line (`${line.channel}.${String(line.index)}`)}
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
            <FieldRow
              label={field.label}
              kind={field.kind}
              value={field.value}
              unit={field.kind === 'number' ? field.unit : undefined}
              min={field.kind === 'number' ? field.min : undefined}
              max={field.kind === 'number' ? field.max : undefined}
              step={field.kind === 'number' ? field.step : undefined}
              problem={problemAt(line.channel, line.index, field.key) ?? problemAt(line.channel, line.index)}
              onchange={(value) => void setField(entry, line, field.key, field.label, value)}
            />
          {/each}
        </div>
      </article>
    {:else}
      <p class="lead">Nothing happens yet. Add an effect the player will feel.</p>
    {/each}

    {#if choosing}
      <div class="choices" role="group" aria-label="Add an effect">
        {#each EFFECT_KINDS as choice (choice.kind)}
          <Button onclick={() => void addEffect(entry, choice.kind, choice.words)}>{choice.words}</Button>
        {/each}
        <Button variant="quiet" onclick={() => (choosing = false)}>Cancel</Button>
      </div>
    {:else}
      <div class="actions">
        <Button variant="primary" onclick={() => (choosing = true)}>Add an effect</Button>
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
</section>

<style>
  .canvas {
    display: grid;
    align-content: start;
    gap: var(--space-4);
    max-width: 40rem;
    padding: var(--space-5);
    overflow-y: auto;
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
