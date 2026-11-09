// Feeds `createNetStatus` from the host: on every connection change and four times a second while time matters (the two seconds
// of "connected", the reconnect countdown). Calls `onView` only when the view changed.
import type { NetUiHost } from '../../shared/host'
import { createNetStatus, type NetStatusView } from './net-status'

const REFRESH_MS = 250

const same = (a: NetStatusView, b: NetStatusView): boolean =>
  a.badge === b.badge && a.overlay === b.overlay && a.secondsLeft === b.secondsLeft

/**
 * Calls `onView` with what to draw now, and again whenever the connection changes or time passes.
 * Returns a function that stops it.
 */
export function watchStatus(host: NetUiHost, onView: (view: NetStatusView) => void): () => void {
  const status = createNetStatus({ graceSeconds: host.graceSeconds })
  const now = host.now ?? (() => performance.now())
  let shown: NetStatusView | undefined
  const refresh = (): void => {
    const view = status.update(host.connection.get(), now())
    if (shown !== undefined && same(shown, view)) return
    shown = view
    onView(view)
  }
  refresh()
  const off = host.connection.subscribe(refresh)
  const timer = setInterval(refresh, REFRESH_MS)
  return () => {
    off()
    clearInterval(timer)
  }
}
