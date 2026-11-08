<!--
  Writer's list: the game's scenes, and under the chosen scene its lines and each conversation by who speaks. A scene
  is a place in the story; adding one asks only what to call it.
-->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import { humanize } from '../../shared/id-words.ts'
import type { WriterSession } from './writer-session.svelte.ts'

const { session }: { session: WriterSession } = $props()
let adding = $state(false)
let name = $state('')

async function addScene(): Promise<void> {
  if (name.trim() === '') return
  await session.addScene(name)
  adding = false
  name = ''
}

function speakerOf(index: number): string {
  const graph = session.graphs[index]
  if (graph === undefined) return ''
  const same = session.graphs.filter((other) => other.speaker === graph.speaker)
  const place = same.indexOf(graph)
  return same.length > 1
    ? `${session.nameOf(graph.speaker)} (${String(place + 1)})`
    : session.nameOf(graph.speaker)
}
</script>

<nav class="list" aria-label="Scenes">
  <ul>
    {#each session.scenes as scene (scene)}
      <li>
        <button type="button" aria-current={session.scene === scene} onclick={() => void session.chooseScene(scene)}>
          {humanize(scene)}
        </button>
        {#if session.scene === scene}
          <ul class="inside" aria-label="In {humanize(scene)}">
            <li>
              <button
                type="button"
                aria-current={session.view.kind === 'lines'}
                onclick={() => (session.view = { kind: 'lines' })}
              >
                Lines
              </button>
            </li>
            {#each session.graphs as _graph, index (index)}
              <li>
                <button
                  type="button"
                  aria-current={session.view.kind === 'talk' && session.view.graph === index}
                  onclick={() => (session.view = { kind: 'talk', graph: index })}
                >
                  {speakerOf(index)}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </li>
    {/each}
  </ul>
  {#if adding}
    <form
      onsubmit={(submitted) => {
        submitted.preventDefault()
        void addScene()
      }}
    >
      <label for="writer-scene">What is this place called?</label>
      <input id="writer-scene" bind:value={name} />
      <div class="actions">
        <Button variant="quiet" onclick={() => (adding = false)}>Cancel</Button>
        <Button variant="primary" disabled={name.trim() === ''} onclick={() => void addScene()}>Add</Button>
      </div>
    </form>
  {:else}
    <Button onclick={() => (adding = true)}>Add a scene</Button>
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
  .inside {
    margin-left: var(--space-4);
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
