<!--
  The Ask diff dialog: the prompt and its scope chip, the token
  meter, then the proposal as a line diff with the `before` findings under the lines they name, the check results,
  and Accept, Reject and Rewrite. Accept is disabled with its reason (a failing check, a locked key, a path Ask may not
  write); Rewrite asks again with the findings. Over budget and a failed provider are alerts. The state is the Ask
  session's (`core/ask-session.ts`); this only draws it and reports the person's choice.
-->
<script lang="ts">
import Button from '../../../shared/kit/widgets/Button.svelte'
import Dialog from '../../../shared/kit/widgets/Dialog.svelte'
import type { AskRefusal, AskState } from '../core/ask-session'

interface Props {
  open: boolean
  view: AskState
  scope: readonly string[]
  /** The open change set's tokens; `undefined` hides the meter. */
  tokens?: { readonly used: number; readonly cap: number } | undefined
  onask: (prompt: string) => void
  onaccept: () => void
  onreject: () => void
  onrewrite: () => void
  onclose: () => void
}

const { open, view, scope, tokens, onask, onaccept, onreject, onrewrite, onclose }: Props = $props()

const uid = $props.id()
let prompt = $state('')

const shown = $derived(view.kind === 'shown' ? view : undefined)
const canAsk = $derived(view.kind === 'idle' || view.kind === 'failed')

function reasonOf(refusal: AskRefusal): string {
  if (refusal.kind === 'checks') return 'A check failed: Rewrite asks again with its findings.'
  if (refusal.kind === 'locked') return `It changes ${refusal.key}, which is locked.`
  return `${refusal.path} cannot take Ask: ${refusal.why}.`
}

/** A line's text without its end, which the diff kept. */
const shownText = (text: string): string => text.replace(/\r?\n$/, '')

function ask(): void {
  if (prompt.trim() !== '') onask(prompt.trim())
}
</script>

<Dialog open={open} title="Ask" width="wide" onclose={() => onclose()}>
  <div class="ask">
    <div class="meta">
      {#each scope as id (id)}<span class="chip">{id}</span>{/each}
      {#if tokens !== undefined}
        <span class="meter-row">
          <span
            class="meter"
            role="meter"
            aria-label="Tokens used"
            aria-valuemin="0"
            aria-valuemax={tokens.cap}
            aria-valuenow={tokens.used}
            style:--fill={`${Math.min(100, (tokens.used / Math.max(1, tokens.cap)) * 100)}%`}
          ></span>
          <span class="dim">{tokens.used} / {tokens.cap} tokens</span>
        </span>
      {/if}
    </div>

    {#if canAsk}
      <label for={`${uid}-prompt`}>Ask for a change</label>
      <textarea id={`${uid}-prompt`} bind:value={prompt} rows="3"></textarea>
    {/if}

    {#if view.kind === 'asking'}
      <p role="status">Asking about “{view.prompt}”…</p>
    {:else if view.kind === 'over-budget'}
      <p role="alert">
        {#if view.tokens > 0}
          This proposal used {view.tokens} tokens, more than the {view.budget} left, so it is not shown;
        {:else}
          No tokens are left in this change set;
        {/if}
        only the owner raises the cap.
      </p>
    {:else if view.kind === 'failed'}
      <p role="alert">The assistant failed: {view.reason}</p>
    {:else if shown !== undefined}
      <p class="summary">{shown.proposal.summary}</p>
      <section class="diff" aria-label="Proposed change" data-scroll-region="both">
        {#each shown.hunks as hunk, index (index)}
          <div class="hunk-head">@@ −{hunk.beforeStart},{hunk.beforeCount} +{hunk.afterStart},{hunk.afterCount} @@</div>
          {#each hunk.lines as line, at (at)}
            <div class="line" data-kind={line.kind}>
              <span class="sign" aria-hidden="true">{line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : ' '}</span>
              <code data-selectable>{shownText(line.text)}</code>
            </div>
            {#if line.kind === 'added'}
              {#each shown.findings.filter((finding) => finding.line === line.after) as finding, n (n)}
                <p class="finding">Line {line.after}: {finding.message}</p>
              {/each}
            {/if}
          {/each}
        {/each}
      </section>
      <ul class="checks">
        {#each shown.results as result (result.check)}
          <li data-status={result.status}>{result.check}: {result.status}</li>
        {/each}
      </ul>
      <p class="dim">{shown.tokens} tokens used by this proposal.</p>
      {#if shown.refusal !== undefined}
        <p id={`${uid}-why`} class="why">{reasonOf(shown.refusal)}</p>
      {/if}
    {/if}
  </div>

  {#snippet actions()}
    {#if shown !== undefined}
      <Button onclick={() => onreject()}>Reject</Button>
      {#if shown.refusal?.kind === 'checks'}
        <Button onclick={() => onrewrite()}>Rewrite</Button>
      {/if}
      <Button
        variant="primary"
        disabled={shown.refusal !== undefined}
        aria-describedby={shown.refusal === undefined ? undefined : `${uid}-why`}
        onclick={() => onaccept()}
      >
        Accept
      </Button>
    {:else}
      <Button onclick={() => onclose()}>Close</Button>
      {#if canAsk}
        <Button variant="primary" disabled={prompt.trim() === ''} onclick={ask}>Ask</Button>
      {/if}
    {/if}
  {/snippet}
</Dialog>

<style>
  .ask {
    display: grid;
    gap: var(--space-2);
    min-width: 0;
    font: var(--text-body-13);
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }
  .chip {
    padding: var(--space-1) var(--space-2);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    font: var(--text-mono-12);
  }
  .meter-row {
    display: inline-flex;
    gap: var(--space-2);
    align-items: center;
    margin-left: auto;
  }
  .meter {
    width: 6rem;
    height: 6px;
    border-radius: var(--edge-sm);
    background: linear-gradient(to right, var(--color-accent-default) var(--fill), var(--color-bg-field) var(--fill));
  }
  textarea {
    min-height: var(--size-hit);
    padding: var(--space-2);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13);
    resize: vertical;
  }
  .diff {
    max-height: 40vh;
    overflow: auto;
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-app);
    font: var(--text-mono-12);
  }
  .hunk-head {
    padding: var(--space-1) var(--space-2);
    color: var(--color-text-dim);
  }
  .line {
    display: flex;
    gap: var(--space-2);
    padding: 0 var(--space-2);
    white-space: pre;
  }
  .line[data-kind='added'] {
    background: color-mix(in srgb, var(--color-state-ok) 18%, transparent);
  }
  .line[data-kind='removed'] {
    background: color-mix(in srgb, var(--color-state-bad) 18%, transparent);
  }
  .finding,
  .why,
  [role='alert'] {
    margin: 0;
    color: var(--color-state-bad);
  }
  .finding {
    padding: 0 var(--space-2) 0 calc(var(--space-2) * 2 + 1ch);
  }
  .checks {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .checks li[data-status='fail'] {
    color: var(--color-state-bad);
  }
  .summary,
  p {
    margin: 0;
  }
  .dim {
    color: var(--color-text-dim);
  }
</style>
