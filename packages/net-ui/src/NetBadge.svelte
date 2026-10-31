<script lang="ts">
// The connection badge (M7 spec §7), drawn in `hud.overlay`: hidden offline; connecting; connected (for two seconds); reconnecting
// with the seconds left; degraded for as long as it lasts. Not interactive, announced by a polite live region that is always there
// so a change is read out.
import { onMount } from 'svelte'
import { copyOf, currentNetUi } from './host'
import { type NetCopyKey, netText } from './net-copy'
import type { NetStatusView } from './net-status'
import { watchStatus } from './watch-status'

const host = currentNetUi()
let view: NetStatusView = $state({ badge: 'hidden', overlay: 'hidden', secondsLeft: undefined })
onMount(() =>
  host === undefined
    ? undefined
    : watchStatus(host, (next) => {
        view = next
      }),
)

const ICON = { connecting: '…', connected: '●', reconnecting: '↻', degraded: '!' } as const
const label = $derived(
  host === undefined || view.badge === 'hidden'
    ? ''
    : netText(`net.badge.${view.badge}` as NetCopyKey, { seconds: view.secondsLeft ?? 0 }, copyOf(host)),
)
</script>

<div class="net-badge-region" role="status" aria-live="polite">
  {#if view.badge !== 'hidden'}
    <div class="net-badge" data-testid="net-badge" data-state={view.badge}>
      <span class="icon" aria-hidden="true">{ICON[view.badge]}</span>
      <span class="label">{label}</span>
    </div>
  {/if}
</div>

<style>
  .net-badge-region {
    position: absolute;
    top: var(--af-space-2, 8px);
    right: var(--af-space-2, 8px);
    pointer-events: none;
    max-width: 50%;
  }
  .net-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgb(0 0 0 / 0.7);
    color: #fff;
    font-size: calc(0.875rem * var(--af-scale, 1));
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .net-badge[data-state='degraded'],
  .net-badge[data-state='reconnecting'] {
    background: rgb(120 60 0 / 0.85);
  }
  .icon {
    flex: none;
    width: 1em;
    text-align: center;
  }
</style>
