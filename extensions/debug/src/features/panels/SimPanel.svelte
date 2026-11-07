<script lang="ts">
// Tick, entity count, last hash and step time, read from the sim probe four times a second.
import { getContext, onMount } from 'svelte'
import { type DebugHost, HOST_CONTEXT } from '../../shared/host'

const probe = getContext<DebugHost | undefined>(HOST_CONTEXT)?.sim
const read = () =>
  probe === undefined
    ? undefined
    : { tick: probe.tick(), entities: probe.entities(), hash: probe.hash(), stepMs: probe.stepMs() }
let row = $state(read())

onMount(() => {
  const timer = setInterval(() => {
    row = read()
  }, 250)
  return () => clearInterval(timer)
})
</script>

{#if row === undefined}
  <p>This game has not turned on the game readout.</p>
{:else}
  <dl>
    <dt>Step count</dt><dd>{row.tick}</dd>
    <dt>Things in the game</dt><dd>{row.entities}</dd>
    <dt>Game fingerprint</dt><dd>{row.hash}</dd>
    <dt>Time per step (ms)</dt><dd>{row.stepMs}</dd>
  </dl>
{/if}
