<!--
  @component
  What the net extension puts in the game's overlay layer: the connection badge and the reconnect overlay.
-->
<script lang="ts">
// What `net` puts in `hud.overlay` (an extension fills a slot with one component): the badge and the reconnect overlay.
import NetBadge from './NetBadge.svelte'
import ReconnectOverlay from './ReconnectOverlay.svelte'
</script>

<NetBadge />
<ReconnectOverlay />
