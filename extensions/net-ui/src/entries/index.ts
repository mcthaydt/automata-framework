// `@automata/net-ui`: the connection badge and the reconnect overlay for `hud.overlay`, their words as locale
// keys, and the host the game installs. Svelte, so apart from the main entry, which stays free of it.

export { default as NetBadge } from '../features/status/NetBadge.svelte'
export { default as NetHud } from '../features/status/NetHud.svelte'
export {
  type BadgeState,
  CONNECTED_SHOWN_MS,
  createNetStatus,
  type NetStatus,
  type NetStatusView,
  type OverlayState,
} from '../features/status/net-status'
export { default as ReconnectOverlay } from '../features/status/ReconnectOverlay.svelte'
export { watchStatus } from '../features/status/watch-status'
export { copyOf, currentNetUi, installNetUi, type NetUiHost } from '../shared/host'
export { NET_COPY_EN, type NetCopyKey, netCopyKeys, netErrorKey, netText } from '../shared/net-copy'
