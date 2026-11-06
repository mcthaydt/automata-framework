<!--
  The inspector of Home: the selected project and the three things a person does with it. The facts are
  the profile's own words (`ProfileSummary`); a profile that gives none still shows its error and warning counts. A file
  that does not open gives its reason and still offers Open, because Open is where the error panel shows it; a file two profiles claim lists them. The actions sit under the title, before the details, so a half-height
  sheet on a phone shows them without scrolling. They stay in place and are disabled while another one runs.
-->
<script lang="ts">
import { modifiedLabel, sizeLabel } from '../../shared/kit/home/project-browse'
import Button from '../../shared/kit/widgets/Button.svelte'
import Pill from '../../shared/kit/widgets/Pill.svelte'
import type { ProjectEntry } from '../../shared/level-2d/documents/project-list'
import { cardTitle, entryBadge } from './home-model'

interface Props {
  /** The selected project; nothing when the list is empty or nothing is chosen. */
  entry: ProjectEntry | undefined
  /** Another action is running. */
  busy: boolean
  now: number
  onopen: () => void
  onduplicate: () => void
  ondelete: () => void
}

const { entry, busy, now, onopen, onduplicate, ondelete }: Props = $props()
const uid = $props.id()

const badge = $derived(entry === undefined ? undefined : entryBadge(entry))
/** What the profile says the project holds; else the findings of its checks. */
function factsOf(
  project: Extract<ProjectEntry, { status: 'ok' }>,
): readonly { label: string; value: string }[] {
  return (
    project.summary?.facts ?? [
      { label: 'Errors', value: String(project.errors) },
      { label: 'Warnings', value: String(project.warnings) },
    ]
  )
}
</script>

{#if entry === undefined}
  <p class="nothing">Select a project</p>
{:else}
  <div class="summary">
    <header>
      <h2>{cardTitle(entry)}</h2>
      <div class="pills">
        {#if badge}<Pill tone={badge.tone}>{badge.text}</Pill>{/if}
        {#if entry.status !== 'ambiguous'}<Pill>{entry.profile.label}</Pill>{/if}
      </div>
    </header>

    <div class="actions">
      <Button variant="primary" disabled={busy} onclick={onopen} data-testid="summary-open">Open</Button>
      <div class="secondary">
        <Button disabled={busy} onclick={onduplicate}>Duplicate</Button>
        <Button variant="danger" disabled={busy} onclick={ondelete}>Delete</Button>
      </div>
    </div>

    {#if entry.status === 'broken'}
      <p class="reason">{entry.message}</p>
    {:else if entry.status === 'ambiguous'}
      <div class="candidates">
        <p id={`${uid}-candidates`}>Could be</p>
        <ul aria-labelledby={`${uid}-candidates`}>
          {#each entry.candidates as candidate (candidate.id)}<li>{candidate.label}</li>{/each}
        </ul>
      </div>
    {:else}
      <dl>
        {#each factsOf(entry) as fact (fact.label)}
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
    padding: var(--space-4);
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
    font: var(--text-title-15);
    overflow-wrap: anywhere;
  }
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .reason {
    margin: 0;
    color: var(--color-state-bad);
    font: var(--text-body-13);
    overflow-wrap: anywhere;
  }
  .candidates p {
    margin: 0 0 var(--space-1);
    color: var(--color-text-dim);
    font: var(--text-label-12);
  }
  .candidates ul {
    margin: 0;
    padding-left: var(--space-5);
    font: var(--text-body-13);
  }
  dl {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
  }
  .fact {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-1) 0;
    border-bottom: 1px solid var(--color-border-default);
    font: var(--text-body-13);
  }
  dt {
    color: var(--color-text-dim);
  }
  dd {
    margin: 0;
    text-align: right;
    overflow-wrap: anywhere;
  }
  .file {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font: var(--text-mono-11);
  }
  .path {
    color: var(--color-text-primary);
    overflow-wrap: anywhere;
  }
  .stats {
    color: var(--color-text-dim);
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .secondary {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }
</style>
