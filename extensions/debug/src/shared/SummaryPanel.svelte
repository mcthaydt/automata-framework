<script lang="ts">
// An extension's summary as rows, read four times a second. Which summary is the panel's own id, set by the overlay.
import { getContext, onMount } from 'svelte'
import { type DebugHost, HOST_CONTEXT, PANEL_CONTEXT } from './host'
import { summaryRows } from './summary-rows'

const id = getContext<string | undefined>(PANEL_CONTEXT) ?? ''
const port = getContext<DebugHost | undefined>(HOST_CONTEXT)?.summaries?.[id]
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
  <p>This game has not turned on the {id} summary.</p>
{:else}
  <dl>
    {#each rows as row (row.name)}
      <dt>{row.name}</dt><dd>{row.value}</dd>
    {/each}
  </dl>
{/if}
