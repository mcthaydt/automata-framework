<!--
  The script of the chosen scene: its lines, or one of its conversations. A scene with no files yet says what to do
  next; a file with a mistake opens read only and says where the mistake is.
-->
<script lang="ts">
import { Button, EmptyState } from '@automata/editor/kit'
import EditorPage from '../../shared/ui/EditorPage.svelte'
import WriterConversation from './WriterConversation.svelte'
import WriterLines from './WriterLines.svelte'
import type { WriterSession } from './writer-session.svelte.ts'

const { session }: { session: WriterSession } = $props()
let name = $state('story')

const lines = $derived(session.files?.lines.read)
const dialogue = $derived(session.files?.dialogue.read)
const message = $derived(session.files?.lines.message ?? session.files?.dialogue.message)
const broken = $derived(lines?.kind === 'syntax' ? lines : dialogue?.kind === 'syntax' ? dialogue : undefined)
</script>

<EditorPage label="Writer">
  {#if session.scene === undefined}
    <EmptyState
      icon="message"
      title="This game has no words yet."
      why="Words belong to a scene, a place in your story. Give the first one a name."
    >
      <div class="fields">
        <label for="writer-first-scene">What is this place called?</label>
        <input id="writer-first-scene" bind:value={name} />
      </div>
      <Button disabled={name.trim() === ''} onclick={() => void session.addScene(name)}>
        Start writing
      </Button>
    </EmptyState>
  {:else if broken !== undefined}
    <div class="empty">
      <h2>A file of this scene has a mistake{broken.line === undefined ? '' : ` on line ${String(broken.line)}`}.</h2>
      <p>It opens read only until the mistake is fixed. Your file is unchanged.</p>
    </div>
  {:else}
    {#if message !== undefined}<p class="bad" role="alert">{message}</p>{/if}
    {#if session.note !== undefined}<p class="note" role="status">{session.note}</p>{/if}
    {#if session.view.kind === 'lines'}
      <WriterLines {session} />
    {:else}
      <WriterConversation {session} graph={session.view.graph} />
    {/if}
  {/if}
</EditorPage>

<style>
  .empty {
    display: grid;
    justify-items: start;
    gap: var(--space-3);
  }
  .fields {
    display: grid;
    gap: var(--space-1);
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
  .note {
    color: var(--color-text-dim);
  }
</style>
