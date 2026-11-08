<!--
  Feel's list: one row per thing that happens in the game, "When player hit", then the limits every effect is held
  to. Adding a feel asks only what happens; its effects are added on the canvas.
-->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import { addFeelEdit, eventWords } from './feel-model.ts'
import type { FeelSession } from './feel-session.svelte.ts'

const { session }: { session: FeelSession } = $props()
let adding = $state(false)
let event = $state('')
const entries = $derived(session.content?.entry ?? [])

async function add(): Promise<void> {
  const on = event.trim()
  const content = session.content
  if (on === '' || content === undefined) return
  const outcome = await session.change(`Add a feel for ${eventWords(on)}`, [addFeelEdit(content, on)])
  if (!outcome.ok) return
  session.chosen = entries.length - 1
  adding = false
  event = ''
}
</script>

{#if session.content !== undefined}
  <nav class="list" aria-label="Feels">
    <ul>
      {#each entries as entry, index (index)}
        <li>
          <button type="button" aria-current={session.chosen === index} onclick={() => (session.chosen = index)}>
            When {eventWords(entry.on)}
          </button>
        </li>
      {/each}
      <li>
        <button type="button" aria-current={session.chosen === 'limits'} onclick={() => (session.chosen = 'limits')}>
          Never more than
        </button>
      </li>
    </ul>
    {#if adding}
      <form
        onsubmit={(submitted) => {
          submitted.preventDefault()
          void add()
        }}
      >
        <label for="feel-event">What happens in the game?</label>
        <input id="feel-event" bind:value={event} placeholder="player.hit" />
        <div class="actions">
          <Button variant="quiet" onclick={() => (adding = false)}>Cancel</Button>
          <Button variant="primary" disabled={event.trim() === ''} onclick={() => void add()}>Add</Button>
        </div>
      </form>
    {:else}
      <Button variant="primary" onclick={() => (adding = true)}>Add a feel</Button>
    {/if}
  </nav>
{/if}

<style>
  .list {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-3);
  }
  ul {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li button {
    width: 100%;
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 0;
    border-radius: var(--edge-sm);
    background: transparent;
    color: var(--color-text-primary);
    font: var(--text-body-13);
    text-align: left;
    cursor: pointer;
  }
  li button[aria-current='true'] {
    background: var(--color-accent-soft);
    font: var(--text-body-13-medium);
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
