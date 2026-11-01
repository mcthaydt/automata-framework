<!--
  The checks list (the Owner, testing base-3d on an iPad: the "17 problems" pill showed no list): each failing check with
  its problems in the model's own sentences. A problem that has a place gets a Show button (44 px) that selects it and
  centres the plan on it; one the level no longer has says why in a status line. A clean level says so. The list follows
  the checks as they re-run.
-->
<script lang="ts">
import { Button } from '@mcthaydt/automata-editor-kit'
import { onDestroy } from 'svelte'
import type { ChecksPanel } from '../../app/checks-panel-controller'

// `clean: false` where the caller already says how the checks stand (a clean level is then said once).
const { checks, clean = true }: { checks: ChecksPanel; clean?: boolean } = $props()

// svelte-ignore state_referenced_locally
let view = $state.raw(checks.view)
let refusal = $state<string | undefined>(undefined)
// svelte-ignore state_referenced_locally
const stop = checks.subscribe(() => (view = checks.view))
onDestroy(stop)

const failing = $derived(view.results.filter((result) => !result.ok))

function show(locator: Parameters<ChecksPanel['locate']>[0]): void {
  const outcome = checks.locate(locator)
  refusal = outcome.ok ? undefined : outcome.reason
}
</script>

<div class="checks" data-testid="checks-list">
  {#if failing.length === 0 && clean}
    <p class="clean">No problems</p>
  {/if}
  {#each failing as result (result.id)}
    <section role="group" aria-label={`${result.id} check`} data-severity={result.severity}>
      <h3>{result.id} <span class="tag">{result.severity}</span></h3>
      <ul>
        {#each result.problems as problem, index (index)}
          <li>
            <span class="message">{problem.message}</span>
            {#if problem.locator !== undefined}
              <Button onclick={() => show(problem.locator)} aria-label={`Show: ${problem.message}`}>Show</Button>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/each}
  {#if refusal !== undefined}<p class="refusal" role="status">{refusal}</p>{/if}
</div>

<style>
  .checks {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-3);
    font: var(--text-body-13);
    color: var(--color-text-primary);
  }
  h3 {
    margin: 0 0 var(--space-1);
    font: var(--text-label-12);
    color: var(--color-text-dim);
  }
  .tag {
    margin-inline-start: var(--space-2);
    text-transform: uppercase;
  }
  [data-severity='error'] .tag {
    color: var(--color-status-bad, var(--color-text-primary));
  }
  ul {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }
  .message {
    flex: 1 1 auto;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .clean,
  .refusal {
    margin: 0;
    color: var(--color-text-dim);
  }
</style>
