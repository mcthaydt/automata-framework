<!--
  The Ship dialog: the change set's title and a description
  drafted from its changes, checks and gates, which the person edits first; the files, the checks and the gates;
  then Ship, which checkpoints, pushes the branch and opens a draft PR, or gives the compare link when `gh` is not
  there. A failing check warns and still allows Ship: the PR is a draft. A gate still needs the owner; nothing here
  records one. A push that fails shows the reason, and the commits stay where they are.
-->
<script lang="ts">
import Button from '../../../shared/kit/widgets/Button.svelte'
import Dialog from '../../../shared/kit/widgets/Dialog.svelte'
import type { ReviewChangeSet } from '../core/review-model'
import type { ShipOutcome } from './suite-session'

interface Props {
  open: boolean
  /** The open change set, its drafted description, or `undefined` while it loads or with none open. */
  review: ReviewChangeSet | undefined
  draft: { readonly title: string; readonly body: string } | undefined
  onship: (draft: { title: string; body: string }) => Promise<ShipOutcome>
  onclose: () => void
}

const { open, review, draft, onship, onclose }: Props = $props()

const uid = $props.id()
let title = $state('')
let body = $state('')
let phase = $state<'ready' | 'pushing' | 'done'>('ready')
let outcome = $state<ShipOutcome>()

// A fresh draft each time the dialog opens on a change set.
$effect(() => {
  if (!open || draft === undefined) return
  title = draft.title
  body = draft.body
  phase = 'ready'
  outcome = undefined
})

const failing = $derived(
  review?.checks.filter((check) => check.status === 'fail' || check.status === 'error') ?? [],
)

async function ship(): Promise<void> {
  phase = 'pushing'
  outcome = await onship({ title: title.trim(), body })
  phase = 'done'
}
</script>

<Dialog {open} title="Ship this change" width="wide" onclose={() => onclose()}>
  {#if review === undefined || draft === undefined}
    <p class="note">No change set is open, so there is nothing to ship.</p>
  {:else if phase === 'done' && outcome !== undefined && 'error' in outcome}
    <p class="result" role="alert">The push failed: {outcome.error}</p>
    <p class="note">Your commits stay on this computer; nothing was lost.</p>
  {:else if phase === 'done' && outcome !== undefined && 'pushed' in outcome}
    <p class="result" role="status">Pushed {outcome.branch}.</p>
    {#if outcome.pr !== undefined}
      <p><a href={outcome.pr} target="_blank" rel="noreferrer">Open the draft pull request</a></p>
    {:else}
      <p class="note">GitHub's command line is not available here, so no pull request was opened.</p>
      <p><a href={outcome.compareUrl} target="_blank" rel="noreferrer">Open the pull request on GitHub</a></p>
    {/if}
    <p class="note">Any gate this change reopens still needs the owner.</p>
  {:else}
    <div class="form">
      <label for={`${uid}-title`}>Title</label>
      <input id={`${uid}-title`} type="text" bind:value={title} autocomplete="off" disabled={phase === 'pushing'} />
      <label for={`${uid}-body`}>Description</label>
      <textarea id={`${uid}-body`} bind:value={body} rows="10" disabled={phase === 'pushing'}></textarea>
      {#if failing.length > 0}
        <p class="warn" role="note">
          {failing.map((check) => check.check).join(', ')}
          {failing.length === 1 ? 'is' : 'are'} failing. Ship still opens a draft.
        </p>
      {/if}
      <h3>Files</h3>
      <ul>
        {#each review.files as file (file.path)}<li><code>{file.path}</code>{file.created ? ' (new)' : ''}</li>{/each}
      </ul>
      <h3>Gates</h3>
      {#if review.gates.reopened.length === 0}
        <p class="note">No gates.</p>
      {:else}
        <ul>
          {#each review.gates.reopened as gate (gate.id)}
            <li>{gate.name}: {gate.decision === 'unknown' ? 'state unknown' : gate.decision}</li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
  {#snippet actions()}
    {#if phase === 'done' || review === undefined}
      <Button onclick={() => onclose()}>Close</Button>
    {:else}
      <Button onclick={() => onclose()} disabled={phase === 'pushing'}>Cancel</Button>
      <Button variant="primary" disabled={phase === 'pushing' || !/[a-z0-9]/i.test(title)} onclick={() => void ship()}
        >{phase === 'pushing' ? 'Pushing…' : 'Ship'}</Button
      >
    {/if}
  {/snippet}
</Dialog>

<style>
  .form {
    display: grid;
    gap: var(--space-2);
  }
  input,
  textarea {
    box-sizing: border-box;
    width: 100%;
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  textarea {
    resize: vertical;
    font: var(--text-mono-12);
  }
  h3 {
    margin: var(--space-3) 0 0;
    font: var(--text-title-15);
  }
  ul {
    margin: 0;
    padding-left: var(--space-5);
  }
  code {
    overflow-wrap: anywhere;
  }
  .note,
  .result,
  .warn {
    margin: 0;
  }
  .note {
    color: var(--color-text-dim);
  }
  .warn {
    color: var(--color-state-warn);
  }
  a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--color-accent-default);
  }
</style>
