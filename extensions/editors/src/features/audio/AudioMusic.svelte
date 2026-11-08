<!--
  Music in Audio is imported, never made. A track is a sound file from the game's folder; this page says how the game
  switches to it (how fast it fades in, whether it loops) and, on the other page, which track plays when. Nothing here
  makes a note.
-->
<script lang="ts">
import type { Condition } from '@automata/audio-synth'
import { Button } from '@automata/editor/kit'
import FieldRow from '../../shared/ui/FieldRow.svelte'
import { removeEdit } from './audio-model.ts'
import type { AudioSession } from './audio-session.svelte.ts'
import {
  addRuleEdit,
  addTrackEdit,
  conditionEdits,
  moveRuleEdits,
  playChoices,
  ruleLines,
  trackAlias,
  trackEdit,
  trackFields,
  unusedTracks,
} from './music-model.ts'

const { session }: { session: AudioSession } = $props()
let removing = $state(false)
let asking = $state<{ key: string; op: 'is' | 'atLeast' | 'atMost'; value: string }>({
  key: '',
  op: 'is',
  value: '',
})
let askingFor = $state<number | undefined>()

const content = $derived(session.content)
const chosen = $derived(session.chosen)
const index = $derived(chosen.kind === 'track' ? chosen.index : undefined)
const track = $derived(index === undefined ? undefined : content?.slot?.[index])
const unused = $derived(content === undefined ? [] : unusedTracks(content, session.files))
const rules = $derived(content === undefined ? [] : ruleLines(content))

const OPS = [
  { value: 'is', label: 'is' },
  { value: 'atLeast', label: 'is at least' },
  { value: 'atMost', label: 'is at most' },
] as const

/** What the person typed as a value: a number, yes or no, or words. */
function valueTyped(text: string): string | number | boolean {
  const trimmed = text.trim()
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  if (trimmed === 'yes') return true
  if (trimmed === 'no') return false
  return trimmed
}

function conditionOf(op: 'is' | 'atLeast' | 'atMost', text: string): Condition {
  const value = valueTyped(text)
  if (op === 'is') return value
  return { [op]: typeof value === 'number' ? value : 0 } as Condition
}

async function useTrack(path: string): Promise<void> {
  if (content === undefined) return
  const at = content.slot?.length ?? 0
  const outcome = await session.change(`Use the track ${trackAlias(path)}`, addTrackEdit(content, path))
  if (outcome.ok) session.chosen = { kind: 'track', index: at }
}

async function addRule(): Promise<void> {
  const first = content?.slot?.[0]?.id
  if (content === undefined || first === undefined) return
  await session.change('Add a music rule', addRuleEdit(content, first))
}

async function addCondition(rule: number): Promise<void> {
  const current = content?.music_rule?.[rule]
  if (current === undefined || asking.key.trim() === '') return
  const outcome = await session.change(
    'Add what the music waits for',
    conditionEdits(current, rule, asking.key.trim(), conditionOf(asking.op, asking.value)),
  )
  if (outcome.ok) {
    asking = { key: '', op: 'is', value: '' }
    askingFor = undefined
  }
}

async function removeTrack(at: number, id: string): Promise<void> {
  const outcome = await session.change(`Remove the track ${id}`, [removeEdit('slot', at)])
  if (!outcome.ok) return
  removing = false
  session.chosen = { kind: 'rules' }
}
</script>

{#if chosen.kind === 'track' && track !== undefined && index !== undefined}
  <h2>{track.id}</h2>
  {@const file = session.files.find((path) => trackAlias(path) === (track.sound ?? track.id))}
  {#if file !== undefined}
    <p>This track plays the file {file}.</p>
  {:else}
    <p class="bad" role="status">The game has no music file called {track.sound ?? track.id} yet.</p>
  {/if}
  <div class="fields">
    {#each trackFields(track) as field (field.key)}
      <FieldRow
        label={field.label}
        kind={field.kind}
        value={field.value}
        options={field.kind === 'choice' ? field.options : undefined}
        unit={field.kind === 'number' ? field.unit : undefined}
        min={field.kind === 'number' ? field.min : undefined}
        max={field.kind === 'number' ? field.max : undefined}
        step={field.kind === 'number' ? field.step : undefined}
        onchange={(value) =>
          void session.change(
            `Change ${field.label.toLowerCase()}`,
            [trackEdit(index, field, (track as unknown as Record<string, unknown>)[field.key], value)],
            `slot.${String(index)}.${field.key}`,
          )}
      />
    {/each}
  </div>
  <div class="actions">
    {#if removing}
      <span class="actions" role="group" aria-label={`Remove ${track.id}?`}>
        <p>Remove {track.id}? Rules that play it will play nothing.</p>
        <Button variant="danger" onclick={() => void removeTrack(index, track.id)}>Remove</Button>
        <Button variant="quiet" onclick={() => (removing = false)}>Keep it</Button>
      </span>
    {:else}
      <Button variant="quiet" onclick={() => (removing = true)}>Remove {track.id}</Button>
    {/if}
  </div>
{:else if content !== undefined}
  <h2>What music plays when</h2>
  <p>The game plays the first rule that holds. Put the most particular ones first.</p>
  {#if unused.length > 0}
    <section class="card" aria-label="Tracks in your game folder">
      <h3>Tracks in your game folder</h3>
      {#each unused as path (path)}
        <div class="actions">
          <span>{path}</span>
          <Button onclick={() => void useTrack(path)}>Use this track</Button>
        </div>
      {/each}
    </section>
  {/if}
  {#if (content.slot ?? []).length === 0 && unused.length === 0}
    <p>No music yet. Put a music file in your game's folder and it shows up here to use.</p>
  {/if}
  {#each rules as rule (rule.index)}
    {@const rowData = content.music_rule?.[rule.index]}
    <article class="card" aria-label={rule.words}>
      <h3>{rule.words}</h3>
      {#each rule.conditions as condition (condition.key)}
        <div class="actions">
          <span>{condition.words}</span>
          <Button
            variant="quiet"
            aria-label={`Stop waiting for ${condition.key}`}
            onclick={() =>
              rowData !== undefined &&
              void session.change('Take away a music condition', conditionEdits(rowData, rule.index, condition.key, undefined))}
          >
            Remove
          </Button>
        </div>
      {/each}
      <FieldRow
        label="Play"
        kind="choice"
        value={rowData?.slot ?? ''}
        options={playChoices(content)}
        onchange={(value) =>
          void session.change('Change what the music plays', [
            { keyPath: ['music_rule', rule.index, 'slot'], expected: rowData?.slot, set: String(value) },
          ])}
      />
      {#if askingFor === rule.index}
        <form
          class="ask"
          onsubmit={(submitted) => {
            submitted.preventDefault()
            void addCondition(rule.index)
          }}
        >
          <label for={`ask-key-${String(rule.index)}`}>What does the game keep track of?</label>
          <input id={`ask-key-${String(rule.index)}`} bind:value={asking.key} />
          <select aria-label="Is" bind:value={asking.op}>
            {#each OPS as op (op.value)}<option value={op.value}>{op.label}</option>{/each}
          </select>
          <input aria-label="Value" bind:value={asking.value} />
          <div class="actions">
            <Button variant="quiet" onclick={() => (askingFor = undefined)}>Cancel</Button>
            <Button variant="primary" disabled={asking.key.trim() === ''} onclick={() => void addCondition(rule.index)}>
              Add
            </Button>
          </div>
        </form>
      {:else}
        <div class="actions">
          <Button onclick={() => (askingFor = rule.index)}>Wait for something</Button>
          <Button
            variant="quiet"
            disabled={rule.index === 0}
            onclick={() => void session.change('Move a music rule up', moveRuleEdits(content, rule.index, rule.index - 1))}
          >
            Move up
          </Button>
          <Button
            variant="quiet"
            disabled={rule.index === rules.length - 1}
            onclick={() => void session.change('Move a music rule down', moveRuleEdits(content, rule.index, rule.index + 1))}
          >
            Move down
          </Button>
          <Button
            variant="quiet"
            onclick={() => void session.change('Remove a music rule', [removeEdit('music_rule', rule.index)])}
          >
            Remove
          </Button>
        </div>
      {/if}
    </article>
  {/each}
  {#if (content.slot ?? []).length > 0}
    <div class="actions"><Button variant="primary" onclick={() => void addRule()}>Add a rule</Button></div>
  {/if}
{/if}

<style>
  .fields,
  .card,
  .ask {
    display: grid;
    gap: var(--space-3);
  }
  .card {
    padding: var(--space-4);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-md);
    background: var(--color-bg-surface);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .bad {
    color: var(--color-state-bad);
  }
  label {
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  input,
  select {
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
</style>
