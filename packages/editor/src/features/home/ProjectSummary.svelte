<!--
  A level's Details, opened from its card's More menu: what the level holds in the profile's own words
  (`ProfileSummary`; a profile that gives none still shows its problem counts), why a file does not open, or which
  profiles could open it, and then the file itself: its path, size and when it changed. The file facts live here, out
  of the card, because only someone who asks needs them.
-->
<script lang="ts">
import { sizeLabel } from '../../shared/kit/home/project-browse'
import Pill from '../../shared/kit/widgets/Pill.svelte'
import type { ProjectEntry } from '../../shared/level-2d/documents/project-list'
import { entryBadge, whenLabel } from './home-model'

interface Props {
  entry: ProjectEntry
  now: number
}

const { entry, now }: Props = $props()
const uid = $props.id()

const badge = $derived(entryBadge(entry))
/** What the profile says the level holds; else what its checks found. */
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

<div class="summary">
  {#if badge || entry.status !== 'ambiguous'}
    <div class="pills">
      {#if badge}<Pill tone={badge.tone}>{badge.text}</Pill>{/if}
      {#if entry.status !== 'ambiguous'}<Pill>{entry.profile.label}</Pill>{/if}
    </div>
  {/if}

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

  <dl class="file">
    <div class="fact"><dt>File</dt><dd class="path">{entry.path}</dd></div>
    <div class="fact"><dt>Size</dt><dd>{sizeLabel(entry.size)}</dd></div>
    <div class="fact"><dt>Changed</dt><dd>{whenLabel(entry.mtime, now)}</dd></div>
  </dl>
</div>

<style>
  .summary {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .reason {
    margin: 0;
    color: var(--bad);
    font: var(--text-body-13);
    overflow-wrap: anywhere;
  }
  .candidates p {
    margin: 0 0 var(--space-1);
    color: var(--muted);
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
    border-bottom: 1px solid var(--line);
    font: var(--text-body-13);
  }
  dt {
    flex: none;
    color: var(--muted);
  }
  dd {
    margin: 0;
    min-width: 0;
    text-align: right;
    overflow-wrap: anywhere;
  }
  .path {
    font: var(--text-mono-11);
  }
</style>
