<!--
  Audio's list: the sounds, the music tracks and the order they play in, and the page of what plays when things happen. A new sound is added here,
  with a name no other sound has, and can be played at once.
-->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import { addSoundEdit, newSoundId } from './audio-model.ts'
import type { AudioChoice, AudioSession } from './audio-session.svelte.ts'

const { session }: { session: AudioSession } = $props()
const content = $derived(session.content)

const isChosen = (choice: AudioChoice): boolean =>
  session.chosen.kind === choice.kind &&
  (choice.kind === 'events' ||
    choice.kind === 'rules' ||
    (session.chosen.kind !== 'events' &&
      session.chosen.kind !== 'rules' &&
      session.chosen.index === choice.index))

async function addSound(): Promise<void> {
  if (content === undefined) return
  const id = newSoundId(content)
  const index = content.cue?.length ?? 0
  const outcome = await session.change(`Add the sound ${id}`, [addSoundEdit(content, id)])
  if (outcome.ok) session.chosen = { kind: 'sound', index }
}
</script>

{#if content !== undefined}
  <nav class="list" aria-label="Sounds and music">
    <h2>Sounds</h2>
    <ul>
      {#each content.cue ?? [] as cue, index (index)}
        <li>
          <button
            type="button"
            aria-current={isChosen({ kind: 'sound', index })}
            onclick={() => (session.chosen = { kind: 'sound', index })}
          >
            {cue.id}{#if cue.draft}<span class="tag"> Placeholder</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
    <Button variant="primary" onclick={() => void addSound()}>Add a sound</Button>
    <h2>Music</h2>
    <ul>
      {#each content.slot ?? [] as track, index (index)}
        <li>
          <button
            type="button"
            aria-current={isChosen({ kind: 'track', index })}
            onclick={() => (session.chosen = { kind: 'track', index })}
          >
            {track.id}
          </button>
        </li>
      {/each}
      <li>
        <button
          type="button"
          aria-current={isChosen({ kind: 'rules' })}
          onclick={() => (session.chosen = { kind: 'rules' })}
        >
          What music plays when
        </button>
      </li>
    </ul>
    <ul>
      <li>
        <button
          type="button"
          aria-current={isChosen({ kind: 'events' })}
          onclick={() => (session.chosen = { kind: 'events' })}
        >
          When things happen
        </button>
      </li>
    </ul>
  </nav>
{/if}

<style>
  .list {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
  }
  h2 {
    margin: var(--space-2) 0 0;
    padding: 0 var(--space-3);
    color: var(--color-text-faint);
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
  .tag {
    color: var(--color-text-faint);
  }
</style>
