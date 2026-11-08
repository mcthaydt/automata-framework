<!--
  "Check the sounds" and what it found in the sound on this page, in words. The check renders every sound off screen, so
  nothing is heard, and runs only when asked. A sound changed since is marked, never shown with an old finding.
-->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import { findingWords } from './audio-findings.ts'
import type { AudioSession } from './audio-session.svelte.ts'

const { session, id }: { session: AudioSession; id: string } = $props()
const state = $derived(session.checkState(id))
const found = $derived(session.findingsFor(id))
</script>

<section class="checks" aria-label="Check the sounds">
  <Button disabled={session.checking} onclick={() => void session.runCheck()}>
    {session.checking ? 'Checking…' : 'Check the sounds'}
  </Button>
  {#if session.checkFailure !== undefined}
    <p class="bad" role="alert">{session.checkFailure}</p>
  {:else if state === 'stale'}
    <p>Changed since it was checked. Check the sounds again.</p>
  {:else if state === 'current'}
    {#each found as one (one.kind)}
      <p class="warn">{findingWords(one)}</p>
    {:else}
      <p>Checked: nothing to fix.</p>
    {/each}
  {/if}
</section>

<style>
  .checks {
    display: grid;
    gap: var(--space-2);
    justify-items: start;
  }
  .warn {
    color: var(--color-state-warn);
  }
  .bad {
    color: var(--color-state-bad);
  }
</style>
