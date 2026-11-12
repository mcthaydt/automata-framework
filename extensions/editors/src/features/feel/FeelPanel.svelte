<!--
  Feel's list: one row per thing that happens in the game, "When player hit", then the limits every effect is held
  to. Adding a feel asks only what happens; its effects are added on the canvas.
-->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import EventPicker from '../../shared/ui/EventPicker.svelte'
import { addFeelEdit, eventWords } from './feel-model.ts'
import type { FeelSession } from './feel-session.svelte.ts'

const { session }: { session: FeelSession } = $props()
let adding = $state(false)
const entries = $derived(session.content?.entry ?? [])
const answered = $derived(new Set(entries.map((entry) => entry.on)))

async function add(on: string): Promise<void> {
  const name = on.trim()
  const content = session.content
  if (name === '' || content === undefined) return
  session.adding = true
  const outcome = await session
    .change(`Add a feel for ${eventWords(name)}`, addFeelEdit(content, name))
    .finally(() => {
      session.adding = false
    })
  if (!outcome.ok) return
  session.chosen = entries.length - 1
  adding = false
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
      <EventPicker events={session.events} {answered} onpick={(on) => void add(on)} oncancel={() => (adding = false)} />
    {:else}
      <Button onclick={() => (adding = true)}>Add a feel</Button>
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
</style>
