<!--
  The inspector of the 3D Home (plan ED3D.5c, decision 4): the selected level's file, badge and profile, then Open,
  then its facts (check counts) or the reason it does not open plainly. A broken level still offers Open, which shows
  every problem in the error panel; a facility does not open on its own, so Open is disabled and the reason beside it
  says why (it opens with a level beside it, in World, ED3D.9c). Open sits under the title, before the details, so a
  half-height sheet on a phone shows it without scrolling.
-->
<script lang="ts">
import { Button, Pill } from '@mcthaydt/automata-editor/kit'
import { modifiedLabel, sizeLabel } from '@mcthaydt/automata-editor/kit/core'
import { levelCard, summaryOf } from '../../app/home/home-model'
import type { ProjectEntry } from '../../app/project-list'

interface Props {
  /** The selected entry; nothing when the list is empty. */
  entry: ProjectEntry | undefined
  /** Another action is running. */
  busy: boolean
  now: number
  /** The installed profiles, for the card's colour. */
  installed: readonly string[]
  onopen: () => void
}

const { entry, busy, now, installed, onopen }: Props = $props()
const uid = $props.id()

const card = $derived(entry === undefined ? undefined : levelCard(entry, installed))
const summary = $derived(entry === undefined ? undefined : summaryOf(entry))
</script>

{#if entry === undefined || card === undefined || summary === undefined}
  <p class="nothing">Select a level</p>
{:else}
  <div class="summary">
    <header>
      <h2>{card.title}</h2>
      <div class="pills">
        <Pill tone={card.badge.tone}>{card.badge.text}</Pill>
        <Pill accent={card.accent}>{card.kind}</Pill>
      </div>
    </header>

    <div class="actions">
      <Button
        variant="primary"
        disabled={busy || !summary.openable}
        aria-describedby={summary.reason === undefined ? undefined : `${uid}-reason`}
        onclick={onopen}
        data-testid="summary-open">Open</Button
      >
    </div>

    {#if summary.reason !== undefined}<p class="reason" id={`${uid}-reason`}>{summary.reason}</p>{/if}
    {#if summary.facts.length > 0}
      <dl>
        {#each summary.facts as fact (fact.label)}
          <div class="fact"><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
        {/each}
      </dl>
    {/if}

    <div class="file">
      <span class="path">{entry.path}</span>
      <span class="stats">{sizeLabel(entry.size)} · {modifiedLabel(entry.mtime, now)}</span>
    </div>
  </div>
{/if}

<style>
  .nothing {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .summary {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }
  /* Title and pills share a row where the room allows (a phone's half-height sheet is short), else the pills wrap. */
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
  }
  h2 {
    flex: 1 1 10rem;
    margin: 0;
    overflow-wrap: anywhere;
    font: var(--text-title-15);
  }
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .reason {
    margin: 0;
    color: var(--color-text-dim);
    overflow-wrap: anywhere;
  }
  dl {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background: var(--color-bg-field);
  }
  .fact {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-1) 0;
  }
  dt {
    color: var(--color-text-dim);
  }
  dd {
    margin: 0;
  }
  .file {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    color: var(--color-text-faint);
    font: var(--text-mono-11);
    overflow-wrap: anywhere;
  }
</style>
