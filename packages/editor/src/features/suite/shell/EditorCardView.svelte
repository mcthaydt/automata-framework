<!--
  One editor the game's list names: its name, a plain line on what it is for, and what is in it in words (`cardContents`),
  never a path. The whole card opens an installed editor; an editor this build does not have says so in plain words and
  opens its files read only, file by file.
-->
<script lang="ts">
import type { WorkspaceFile } from '../../../shared/kit/ports/suite-ports'
import Button from '../../../shared/kit/widgets/Button.svelte'
import { cardContents, cardLine, type EditorCard, fileTitle } from './home-model'

interface Props {
  card: EditorCard
  onopen: (card: EditorCard) => void
  onread: (file: WorkspaceFile) => void
  /** Said on the button that starts the first file when the card has none (the try-it sample's "New level"). */
  start?: string | undefined
}

const { card, onopen, onread, start }: Props = $props()

const headingId = $derived(`card-${card.editor}`)
const line = $derived(cardLine(card.editor))
</script>

<section class="card" aria-labelledby={headingId} data-editor={card.editor} data-installed={card.installed}>
  <header>
    <h2 id={headingId}>
      {#if card.installed}
        <button type="button" class="open" onclick={() => onopen(card)}>{card.label}</button>
      {:else}
        {card.label}
      {/if}
    </h2>
    {#if !card.installed}<span class="badge">Not in this build</span>{/if}
  </header>
  {#if line}<p class="line">{line}</p>{/if}
  {#if !card.installed}
    <p class="note">{card.label} isn't in this build. Its files open read only.</p>
    <ul>
      {#each card.rows as file (file.path)}
        <li>
          <button type="button" class="file" onclick={() => onread(file)}>
            <span class="name">{fileTitle(file.path)}</span>
            {#if !file.writable}<span class="why">Read only{file.why ? `: ${file.why}` : ''}</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="contents">{cardContents(card)}</p>
    {#if card.rows.length === 0 && start !== undefined}
      <span class="start"><Button onclick={() => onopen(card)}>{start}</Button></span>
    {/if}
  {/if}
</section>

<style>
  /* A raised card on the window colour. An installed editor's whole card is its button (the name's press covers it), so
     the target is the card, not a small line of text. */
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
    padding: var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--edge-lg);
    background: var(--raise);
    transition: border-color 120ms var(--ease-out);
  }
  .card[data-installed='true']:hover {
    border-color: var(--line-hover);
  }
  .card:has(.open:focus-visible) {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
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
  .open {
    min-width: var(--size-hit);
    min-height: var(--size-hit);
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .open:focus-visible {
    outline: none;
  }
  .open::after {
    position: absolute;
    inset: 0;
    border-radius: var(--edge-lg);
    content: '';
  }
  .badge {
    padding: 2px var(--space-2);
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    color: var(--muted);
    font: var(--text-eyebrow-11);
  }
  .line,
  .note {
    margin: 0;
    color: var(--muted);
    font: var(--text-body-13);
  }
  .contents {
    margin: var(--space-2) 0 0;
    color: var(--tool-faint);
    font: var(--text-mono-12);
  }
  .start {
    position: relative;
    align-self: flex-start;
    margin-top: var(--space-2);
  }
  ul {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .file {
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
  .file:hover {
    background: var(--surface);
  }
  .file:focus-visible {
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
