<!--
  @component
  The banner shown while the game reconnects: it counts down the grace, then says it could not reconnect. Leave is always there, and it gets focus once the grace has passed. It pauses nothing: the game keeps drawing behind it.
-->
<script lang="ts">
// The reconnect overlay, drawn in `hud.overlay`: while reconnecting it counts down the grace; once the grace has
// passed it says so. Leave (48 px) is always there, focused once the grace has passed; Back is Leave. It is a banner, not a
// modal: it pauses nothing in the room and the local loop keeps drawing behind it.
import { onMount } from 'svelte'
import { copyOf, currentNetUi } from '../../shared/host'
import { netText } from '../../shared/net-copy'
import type { NetStatusView } from './net-status'
import { watchStatus } from './watch-status'

const host = currentNetUi()
let view: NetStatusView = $state({ badge: 'hidden', overlay: 'hidden', secondsLeft: undefined })
let leave: HTMLButtonElement | undefined = $state()

onMount(() => {
  if (host === undefined) return undefined
  const off = watchStatus(host, (next) => {
    view = next
  })
  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || view.overlay === 'hidden') return
    event.preventDefault()
    host.leave()
  }
  window.addEventListener('keydown', onKey)
  return () => {
    off()
    window.removeEventListener('keydown', onKey)
  }
})

$effect(() => {
  if (view.overlay === 'expired') leave?.focus()
})
const copy = $derived(host === undefined ? undefined : copyOf(host))
</script>

{#if host !== undefined && copy !== undefined && view.overlay !== 'hidden'}
  <section class="net-reconnect" data-scroll-region data-testid="net-reconnect" data-state={view.overlay} aria-labelledby="net-reconnect-title">
    <div class="text">
      <strong id="net-reconnect-title">{netText('net.reconnect.title', {}, copy)}</strong>
      <span>
        {view.overlay === 'expired'
          ? netText('net.reconnect.expired', {}, copy)
          : netText('net.reconnect.countdown', { seconds: view.secondsLeft ?? 0 }, copy)}
      </span>
    </div>
    <button bind:this={leave} type="button" onclick={() => host.leave()}>
      {netText('net.reconnect.leave', {}, copy)}
    </button>
  </section>
{/if}

<style>
  .net-reconnect {
    position: absolute;
    left: var(--af-space-2, 8px);
    right: var(--af-space-2, 8px);
    bottom: var(--af-space-2, 8px);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    padding: 8px 12px;
    border-radius: 8px;
    background: rgb(0 0 0 / 0.85);
    color: #fff;
    font-size: calc(1rem * var(--af-scale, 1));
    /* Where the room is too short for it (a keyboard up in a short landscape), it scrolls as a declared region. */
    max-height: calc(100% - 2 * var(--af-space-2, 8px));
    overflow-y: auto;
  }
  @media (max-height: 420px) {
    .net-reconnect {
      flex-wrap: nowrap;
      padding: 4px 8px;
    }
    .text {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: baseline;
      column-gap: 8px;
    }
  }
  .text {
    display: flex;
    flex-direction: column;
    flex: 1 1 12em;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  button {
    flex: none;
    min-height: calc(48px * var(--af-scale, 1));
    min-width: calc(48px * var(--af-scale, 1));
    padding: 0 16px;
    font: inherit;
    color: inherit;
    background: rgb(255 255 255 / 0.18);
    border: 1px solid rgb(255 255 255 / 0.5);
    border-radius: 6px;
  }
</style>
