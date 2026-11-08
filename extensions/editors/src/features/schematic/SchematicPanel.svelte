<!--
  Schematic's list: the scene picker, then the scene's characters by name, and "Add a character" at the foot. The parts
  that edit more than a character (places, rules, numbers, fair play, the puzzle) join this list as they are built.
-->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import AddCharacter from './AddCharacter.svelte'
import { modeWords } from './pieces/piece.ts'
import type { SchematicSession } from './schematic-session.svelte.ts'

const { session }: { session: SchematicSession } = $props()
const characters = $derived(session.def?.agents ?? [])
const chosen = $derived(session.chosen)
</script>

<nav class="list" aria-label="Characters">
  {#if session.scenes.length > 1}
    <label class="scene">
      <span>Scene</span>
      <select value={session.scene} onchange={(event) => void session.select(event.currentTarget.value)}>
        {#each session.scenes as scene (scene)}
          <option value={scene}>{modeWords(scene)}</option>
        {/each}
      </select>
    </label>
  {/if}
  {#if session.facts.usesSystems}
    <h2>Characters</h2>
    <ul>
      {#each characters as character, index (character.id)}
        <li>
          <button
            type="button"
            aria-current={chosen.kind === 'character' && chosen.index === index}
            onclick={() => session.choose(index)}
          >
            {modeWords(character.id)}
          </button>
        </li>
      {/each}
    </ul>
    <h2>Scene</h2>
    <ul>
      <li>
        <button type="button" aria-current={chosen.kind === 'places'} onclick={() => (session.chosen = { kind: 'places' })}>Places</button>
      </li>
      <li>
        <button type="button" aria-current={chosen.kind === 'rules'} onclick={() => (session.chosen = { kind: 'rules' })}>Rules</button>
      </li>
      <li>
        <button type="button" aria-current={chosen.kind === 'numbers'} onclick={() => (session.chosen = { kind: 'numbers' })}>Numbers</button>
      </li>
      <li>
        <button type="button" aria-current={chosen.kind === 'fair'} onclick={() => (session.chosen = { kind: 'fair' })}>Fair play</button>
      </li>
    </ul>
    {#if session.read.kind !== 'syntax' && session.read.kind !== 'invalid'}
      <Button variant="primary" disabled={!session.facts.listsSystems} onclick={() => void session.addCharacter()}>Add a character</Button>
      <AddCharacter {session} disabled={!session.facts.listsSystems} />
    {/if}
  {/if}
</nav>

<style>
  .list {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-3);
  }
  h2 {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13-medium);
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
  .scene {
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
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
</style>
