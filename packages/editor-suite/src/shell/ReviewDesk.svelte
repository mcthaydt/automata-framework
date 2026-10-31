<!--
  The Review desk (editor suite spec §5 flow 10, §9 `review-desk`): each open change set from the journal, with each
  changed file's diff from where the change set started, its checks with their findings and measures before and
  after, the gates it reopens with their recorded decisions and links, and the tokens it used. It records nothing:
  there is no button here, only links to where a decision is made. One vertical scroll region.
-->
<script lang="ts">
import type { ReviewChangeSet } from '../core/review-model'
import DiffView from './DiffView.svelte'

interface Props {
  /** `undefined` while the journal is read. */
  reviews: readonly ReviewChangeSet[] | undefined
}

const { reviews }: Props = $props()

const uid = $props.id()
const count = (value: number): string => value.toLocaleString('en-US')
</script>

<div class="scroll" data-testid="review-desk" data-scroll-region="vertical">
  <h1>Review</h1>
  {#if reviews === undefined}
    <p class="note">Reading the change sets…</p>
  {:else if reviews.length === 0}
    <p class="note">No change set is open.</p>
  {/if}
  {#each reviews ?? [] as review, index (review.branch)}
    <section aria-labelledby={`${uid}-${index}`}>
      <h2 id={`${uid}-${index}`}>{review.title}</h2>
      <p class="meta"><code>{review.branch}</code> from <code>{review.base}</code> · <span>{`${count(review.tokens.used)} of ${count(review.tokens.cap)} tokens`}</span></p>

      <h3>Changes</h3>
      {#if review.files.length === 0}<p class="note">No file differs from where the change set started.</p>{/if}
      {#each review.files as file (file.path)}
        <figure>
          <figcaption><code>{file.path}</code>{file.created ? ' (new)' : ''}</figcaption>
          <DiffView hunks={file.hunks} />
        </figure>
      {/each}

      <h3>Checks</h3>
      {#if review.checks.length === 0}<p class="note">No checks have run.</p>{/if}
      <ul>
        {#each review.checks as check (check.check)}
          <li data-status={check.status}>
            <span>{`${check.check}: ${check.status}`}</span>
            {#if check.findings.length > 0 || (check.after?.length ?? 0) > 0}
              <ul>
                {#each check.findings as finding, f (f)}
                  <li>{`${finding.path === undefined ? '' : `${finding.path}${finding.line === undefined ? '' : `:${finding.line}`} `}${finding.message}`}</li>
                {/each}
                {#each check.after ?? [] as after (after.id)}
                  {@const before = check.before?.find((measure) => measure.id === after.id)}
                  <li>{before === undefined || before.value === after.value ? `${after.label}: ${after.value}` : `${after.label}: ${before.value} → ${after.value}`}</li>
                {/each}
              </ul>
            {/if}
          </li>
        {/each}
      </ul>

      <h3>Gates</h3>
      {#if review.gates.unreadable !== undefined}<p class="note">{`Gates not readable: ${review.gates.unreadable}`}</p>{/if}
      {#if review.gates.reopened.length === 0}
        <p class="note">No gates.</p>
      {:else}
        <ul>
          {#each review.gates.reopened as gate (gate.id)}
            <li>
              <span>{gate.decision === 'unknown' ? `${gate.name}: state unknown` : gate.decision === 'open' ? `${gate.name}: open, no decision yet` : `${gate.name}: ${gate.decision} before this change; reopened`}</span>
              {#if gate.url !== undefined}<a href={gate.url} target="_blank" rel="noreferrer">{`${gate.name} record`}</a>{/if}
            </li>
          {/each}
        </ul>
        <p class="note">Gates still need the owner; the editor records no decision.</p>
      {/if}
    </section>
  {/each}
</div>

<style>
  .scroll {
    box-sizing: border-box;
    height: 100%;
    overflow-y: auto;
    padding: var(--space-5);
    background: var(--color-bg-app);
  }
  h1,
  h2,
  h3 {
    margin: 0 0 var(--space-2);
  }
  h1 {
    font: var(--text-title-15);
  }
  h3 {
    margin-top: var(--space-4);
    font: var(--text-eyebrow-11);
    color: var(--color-text-dim);
  }
  section {
    margin-top: var(--space-4);
    padding: var(--space-4);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
  }
  .meta,
  .note {
    margin: 0;
    color: var(--color-text-dim);
  }
  code {
    overflow-wrap: anywhere;
  }
  figure {
    margin: 0 0 var(--space-3);
  }
  ul {
    margin: 0;
    padding-left: var(--space-5);
  }
  [data-status='fail'] > span,
  [data-status='error'] > span {
    color: var(--color-state-bad);
  }
  a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    margin-left: var(--space-2);
    color: var(--color-accent-default);
  }
</style>
