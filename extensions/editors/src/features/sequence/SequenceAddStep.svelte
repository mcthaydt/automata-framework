<!--
  Adds a step to a row at the playhead. A step that needs no more (the camera, a fade, a shake) is added at once; one
  that names something asks it first: who, and which line, lamp, door, clip or prop.
-->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import { untrack } from 'svelte'
import type { SequenceSession } from './sequence-session.svelte.ts'
import { TRACK_WORDS, type TrackId } from './tracks.ts'

const {
  session,
  track,
  who: fixedWho,
  ondone,
}: { session: SequenceSession; track: TrackId; who?: string | undefined; ondone: () => void } = $props()

const needsWho = $derived(track === 'actor' || track === 'cues')
const needsName = $derived(track !== 'actor' && !['camera', 'fade', 'shake', 'flicker'].includes(track))
let who = $state('')
let name = $state('')
let refusal = $state<string | undefined>()

const names = $derived(session.names)
const people = $derived(names.actors)
const options = $derived(
  track === 'caption'
    ? names.lines.map((line) => ({
        value: line.id,
        label: line.words === '' ? 'Nothing written yet' : line.words,
      }))
    : track === 'light'
      ? names.lamps.map((value) => ({ value, label: value }))
      : track === 'doors'
        ? names.doors.map((value) => ({ value, label: value }))
        : track === 'cues'
          ? (names.clips[fixedWho ?? who] ?? []).map((value) => ({ value, label: value }))
          : [],
)
const nameLabel = $derived(
  {
    caption: 'Which line?',
    light: 'Which lamp?',
    doors: 'Which door?',
    time: 'Which time of day?',
    grade: 'Which mood?',
    props: 'Which prop?',
    cues: 'Which clip?',
  }[track as 'caption'] ?? 'Which?',
)

async function add(): Promise<void> {
  const chosenWho = fixedWho ?? (who.trim() === '' ? undefined : who.trim())
  const chosenName = name.trim() === '' ? undefined : name.trim()
  const outcome = await session.addKey(track, { who: chosenWho, name: chosenName })
  if (outcome === undefined) {
    refusal = 'Say which one first.'
    return
  }
  refusal = outcome.ok ? undefined : outcome.message
  if (outcome.ok) ondone()
}

$effect(() => {
  // Steps that need nothing more are added at once, once: adding changes what `add` reads.
  untrack(() => {
    if (!needsWho && !needsName) void add()
  })
})
</script>

{#if needsWho || needsName}
  <form
    class="step"
    aria-label="Add {TRACK_WORDS[track].toLowerCase()}"
    onsubmit={(submitted) => {
      submitted.preventDefault()
      void add()
    }}
  >
    {#if needsWho && fixedWho === undefined}
      <label for="step-who">Who?</label>
      <input id="step-who" list="step-people" bind:value={who} />
      <datalist id="step-people">{#each people as person (person)}<option value={person}></option>{/each}</datalist>
    {/if}
    {#if needsName}
      <label for="step-name">{nameLabel}</label>
      {#if options.length > 0}
        <select id="step-name" bind:value={name}>
          <option value="">Pick one</option>
          {#each options as option (option.value)}<option value={option.value}>{option.label}</option>{/each}
        </select>
      {:else}
        <input id="step-name" bind:value={name} />
      {/if}
    {/if}
    {#if refusal !== undefined}<p class="bad" role="alert">{refusal}</p>{/if}
    <div class="actions">
      <Button variant="quiet" onclick={ondone}>Cancel</Button>
      <Button variant="primary" onclick={() => void add()}>Add here</Button>
    </div>
  </form>
{/if}

<style>
  .step {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
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
  .bad {
    margin: 0;
    color: var(--color-state-bad);
    font: var(--text-body-13);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
