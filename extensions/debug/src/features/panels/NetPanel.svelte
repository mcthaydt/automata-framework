<script lang="ts">
// The net diagnostics: snapshot gaps and reordering, the clock, the buffer, corrections, late commands, round trips, the wire
// and whether the link reads degraded. Read from the summary four times a second.
import { getContext, onMount } from 'svelte'
import { type DebugHost, HOST_CONTEXT } from '../../shared/host'
import { summaryRows } from '../../shared/summary-rows'

const port = getContext<DebugHost | undefined>(HOST_CONTEXT)?.net
let rows = $state(port === undefined ? [] : summaryRows(port.summary()))

onMount(() => {
  if (port === undefined) return undefined
  const timer = setInterval(() => {
    rows = summaryRows(port.summary())
  }, 250)
  return () => clearInterval(timer)
})
</script>

{#if port === undefined}
  <p>This game has not turned on the network details.</p>
{:else}
  <dl>
    {#each rows as row (row.name)}
      <dt>{row.name}</dt><dd>{row.value}</dd>
    {/each}
  </dl>
{/if}
