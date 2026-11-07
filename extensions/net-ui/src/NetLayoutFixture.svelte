<!--
  The badge and the reconnect overlay for the layout contract (M7.5c): drawn as `hud.overlay` is, inside the play screen's field
  under a Back control, in the connection `state` the contract asks for, said in `locale` (English, or xx-long from the
  pseudo-locale content owns). 'expired' is a grace of 50 ms, past by the time the contract looks.
-->
<script lang="ts" module>
export type NetShow = 'connecting' | 'degraded' | 'reconnecting' | 'expired'
</script>

<script lang="ts">
import { pseudoLocalize } from '@mcthaydt/automata-content/locale'
import { ScreenFrame } from '@mcthaydt/automata-ui'
import { onDestroy } from 'svelte'
import { installNetUi } from './host'
import { NET_COPY_EN } from './net-copy'
import NetHud from './NetHud.svelte'

const { show, locale = 'en' }: { show: NetShow; locale?: string } = $props()
const none = (): void => undefined
// A fixture's props are fixed for its mount, so they are read once, inside a closure.
const dispose = ((): (() => void) => {
  const copy =
    locale === 'en'
      ? NET_COPY_EN
      : Object.fromEntries(Object.entries(NET_COPY_EN).map(([key, text]) => [key, pseudoLocalize(text)]))
  return installNetUi({
    connection: {
      get: () => (show === 'expired' ? 'reconnecting' : show),
      subscribe: () => none,
    },
    // 'expired' is a grace that has already run out by the time the contract looks.
    graceSeconds: show === 'expired' ? 0.05 : 30,
    leave: none,
    copy,
  })
})()
onDestroy(dispose)
</script>

<ScreenFrame arrangement="stack" back={none} backLabel="Back">
  {#snippet body()}
    <div class="field" style="position: relative; flex: 1; min-height: 0; width: 100%;">
      <NetHud />
    </div>
  {/snippet}
</ScreenFrame>
