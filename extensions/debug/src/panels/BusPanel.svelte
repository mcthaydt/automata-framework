<script lang="ts">
// The last 50 facts heard on the presentation bus. It only listens.
import { getContext, onDestroy } from 'svelte'
import { RUNTIME_FACTS, recordFacts } from '../fact-log'
import { type DebugHost, HOST_CONTEXT } from '../host'

const host = getContext<DebugHost | undefined>(HOST_CONTEXT)
const log = host?.bus === undefined ? undefined : recordFacts(host.bus, host.facts ?? RUNTIME_FACTS)
let entries = $state(log?.entries() ?? [])
const off = log?.subscribe(() => {
  entries = log.entries()
})
onDestroy(() => {
  off?.()
  log?.dispose()
})
</script>

{#if log === undefined}
  <p>No presentation bus installed.</p>
{:else}
  <ol>
    {#each entries as entry, index (index)}
      <li>{entry.name} {entry.text}</li>
    {/each}
  </ol>
{/if}
