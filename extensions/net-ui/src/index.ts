// `@automata/net/ui`: the connection badge and the reconnect overlay for `hud.overlay` (M7 spec §7), their words as locale
// keys, and the host the game installs. Svelte, so apart from the main entry, which stays free of it.
export { copyOf, currentNetUi, installNetUi, type NetUiHost } from './host'
export { default as NetBadge } from './NetBadge.svelte'
export { default as NetHud } from './NetHud.svelte'
export { NET_COPY_EN, type NetCopyKey, netCopyKeys, netErrorKey, netText } from './net-copy'
export {
  type BadgeState,
  CONNECTED_SHOWN_MS,
  createNetStatus,
  type NetStatus,
  type NetStatusView,
  type OverlayState,
} from './net-status'
export { default as ReconnectOverlay } from './ReconnectOverlay.svelte'
export { watchStatus } from './watch-status'
