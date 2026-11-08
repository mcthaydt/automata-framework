<!--
  One editor the game's list names: what it edits, file by file, each named in words (`fileTitle`), never by its path. An installed
  editor's files open it; an editor this build does not have says so in plain words and opens its files read only.
-->
<script lang="ts">
import type { WorkspaceFile } from '../../../shared/kit/ports/suite-ports'
import { type EditorCard, fileTitle } from './home-model'

interface Props {
  card: EditorCard
  onopen: (card: EditorCard) => void
  onread: (file: WorkspaceFile) => void
}

const { card, onopen, onread }: Props = $props()

const headingId = $derived(`card-${card.editor}`)
</script>

<section class="card" aria-labelledby={headingId} data-editor={card.editor}>
  <header>
    <h2 id={headingId}>{card.label}</h2>
    {#if !card.installed}<span class="badge">Not in this build</span>{/if}
  </header>
  {#if !card.installed}
    <p class="note">{card.label} isn't in this build. Its files open read only.</p>
  {/if}
  {#if card.rows.length === 0}
    <p class="note">No files yet.</p>
  {:else}
    <ul>
      {#each card.rows as file (file.path)}
        <li>
          <button type="button" onclick={() => (card.installed ? onopen(card) : onread(file))}>
            <span class="name">{fileTitle(file.path)}</span>
            {#if !file.writable}<span class="why">Read only{file.why ? `: ${file.why}` : ''}</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  /* A paper card on the field; its files are quiet rows that wash on hover, each the whole width so it is easy to hit. */
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
    padding: var(--space-4) var(--space-3) var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--edge-lg);
    background: var(--paper);
  }
  header {
    display: flex;
    padding: 0 var(--space-1);
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  h2 {
    margin: 0;
    font: var(--text-title-15);
  }
  .badge {
    padding: 2px var(--space-2);
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    color: var(--muted);
    font: var(--text-eyebrow-11);
  }
  .note {
    margin: 0;
    padding: 0 var(--space-1);
    color: var(--muted);
  }
  ul {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  button {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    width: 100%;
    min-height: var(--size-hit);
    padding: var(--space-1);
    border: 0;
    border-radius: var(--edge-sm);
    background: none;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
    transition: background 120ms var(--ease-out);
  }
  button:hover {
    background: var(--surface);
  }
  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
  .name {
    max-width: 100%;
    overflow: hidden;
    font: var(--text-body-13);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .why {
    color: var(--muted);
    font: var(--text-label-12);
  }
</style>
