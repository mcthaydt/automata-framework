<!-- The game's cutscenes, one row each by its name, and a way to add one. -->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import SequenceAdd from './SequenceAdd.svelte'
import type { SequenceSession } from './sequence-session.svelte.ts'

const { session }: { session: SequenceSession } = $props()
let adding = $state(false)
</script>

<nav class="list" aria-label="Cutscenes">
  <ul>
    {#each session.cutscenes as cutscene (cutscene.path)}
      <li>
        <button
          type="button"
          aria-current={session.current?.toml.path === cutscene.path}
          onclick={() => void session.choose(cutscene.path)}
        >
          {cutscene.name}
        </button>
      </li>
    {/each}
  </ul>
  {#if session.cutscenes.length > 0}
    {#if adding}
      <SequenceAdd {session} oncancel={() => (adding = false)} />
    {:else}
      <Button onclick={() => (adding = true)}>Add a cutscene</Button>
    {/if}
  {/if}
</nav>

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
  li > button {
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
  li > button[aria-current='true'] {
    background: var(--color-accent-soft);
    font: var(--text-body-13-medium);
  }
</style>
