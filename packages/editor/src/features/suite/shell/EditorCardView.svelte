<!--
  One editor the game's list names (editor suite spec §9 `suite-home`): what it edits, file by file. An installed
  editor's files open it; an editor this build does not have says so in plain words, names the package that brings it
  (§11, EDS-l) and opens its files read only.
-->
<script lang="ts">
import type { WorkspaceFile } from '../../../shared/kit/ports/suite-ports'
import type { EditorCard } from './home-model'

interface Props {
  card: EditorCard
  onopen: (card: EditorCard) => void
  onread: (file: WorkspaceFile) => void
}

const { card, onopen, onread }: Props = $props()

const provider = $derived(
  card.provider === 'editor-plus'
    ? 'the Plus editors (editor-plus)'
    : card.provider === undefined
      ? undefined
      : `the ${card.provider} package`,
)
const headingId = $derived(`card-${card.editor}`)
</script>

<section class="card" aria-labelledby={headingId} data-editor={card.editor}>
  <header>
    <h2 id={headingId}>{card.label}</h2>
    {#if !card.installed}<span class="badge">Not in this build</span>{/if}
  </header>
  {#if !card.installed}
    <p class="note">
      {card.label} isn't in this build.
      {#if provider}It comes with {provider}.{:else}No package this suite knows brings it.{/if}
      Its files open read only.
    </p>
  {/if}
  {#if card.files.length === 0}
    <p class="note">No files yet.</p>
  {:else}
    <ul>
      {#each card.files as file (file.path)}
        <li>
          <button type="button" onclick={() => (card.installed ? onopen(card) : onread(file))}>
            <span class="path">{file.path}</span>
            {#if !file.writable}<span class="why">Read only{file.why ? `: ${file.why}` : ''}</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
    padding: var(--space-4);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-lg);
    background: var(--color-bg-surface);
  }
  header {
    display: flex;
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
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    color: var(--color-text-dim);
    font: var(--text-eyebrow-11);
  }
  .note {
    margin: 0;
    color: var(--color-text-dim);
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
    min-height: 44px;
    padding: var(--space-1) var(--space-3);
    border: 0;
    border-radius: var(--radius-md);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    text-align: left;
    cursor: pointer;
  }
  button:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: -2px;
  }
  .path {
    max-width: 100%;
    overflow: hidden;
    font: var(--text-mono-12);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .why {
    color: var(--color-text-dim);
    font: var(--text-label-12);
  }
</style>
