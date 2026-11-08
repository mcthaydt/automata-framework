<!--
  "What happens in the game?": the game's events as buttons in words ("player hit"), then "any … event" for each kind
  that has more than one, then a box for something the editor does not know. Feel's "Add a feel" and "Answers", and
  Audio's "When things happen", all ask it this way, so nobody types an id the game offers.
-->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import { eventWords } from '../event-words.ts'
import type { GameEvent } from '../game-events.ts'

interface Props {
  events: readonly GameEvent[]
  /** Event ids the caller does not want offered again (the ones already answered). */
  answered?: ReadonlySet<string>
  /** The id the person chose, or typed. */
  onpick: (id: string) => void
  oncancel: () => void
  /** The word on the button that takes what was typed. */
  addLabel?: string
}

const { events, answered = new Set<string>(), onpick, oncancel, addLabel = 'Add' }: Props = $props()
let typed = $state('')
const id = `event-${Math.random().toString(36).slice(2)}`

// The game's events not answered yet, then "Any … event" for each kind of event that has more than one name.
const offered = $derived(events.filter((event) => !answered.has(event.id)))
const kinds = $derived(
  [
    ...new Set(
      events
        .filter((event) => event.id.includes('.') && !event.id.endsWith('*'))
        .map((event) => event.id.split('.')[0]),
    ),
  ]
    .flatMap((kind) => (kind === undefined ? [] : [`${kind}.*`]))
    .filter((pattern) => !answered.has(pattern) && !offered.some((event) => event.id === pattern)),
)
</script>

<div class="events" role="group" aria-label="What happens in the game?">
  <p class="ask">What happens in the game?</p>
  {#each offered as event (event.id)}
    <button type="button" class="event" onclick={() => onpick(event.id)}>{event.words}</button>
  {/each}
  {#each kinds as pattern (pattern)}
    <button type="button" class="event" onclick={() => onpick(pattern)}>{eventWords(pattern)}</button>
  {/each}
  <form
    onsubmit={(submitted) => {
      submitted.preventDefault()
      if (typed.trim() !== '') onpick(typed.trim())
    }}
  >
    <label for={id}>Something else</label>
    <input {id} bind:value={typed} />
    <div class="actions">
      <Button variant="quiet" onclick={oncancel}>Cancel</Button>
      <Button disabled={typed.trim() === ''} onclick={() => onpick(typed.trim())}>{addLabel}</Button>
    </div>
  </form>
</div>

<style>
  .events {
    display: grid;
    gap: var(--space-1);
  }
  .ask {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .event {
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: transparent;
    color: var(--color-text-primary);
    font: var(--text-body-13);
    text-align: left;
    cursor: pointer;
  }
  form {
    display: grid;
    gap: var(--space-2);
  }
  label {
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  input {
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
