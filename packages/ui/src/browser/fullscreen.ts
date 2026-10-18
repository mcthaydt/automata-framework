// Standalone fullscreen (M4 spec §4.9, M4-D5). From FloorFifty `apps/client/src/ui/fullscreen.ts` at `ac72660`,
// without its hosted branch: under Ruken the landscape gate is off and fullscreen is the host's
// (`Hosting.setFullscreen`), so this is only ever the standalone page asking its own browser, never a way around a
// host's answer. Ruken's SDK answers a standalone page's fullscreen request with `support: 'none'`.
//
// iPhone Safari has no element fullscreen; the nearest thing is running from the Home Screen, so there the gate
// teaches that instead. iPad Safari is sent to the Home Screen too: in element fullscreen WebKit lays "It looks like
// you are typing while in full screen" over fast, repeated taps, which a game is full of (FloorFifty).

import type { FullscreenSupport } from './landscape-gate'

const isIos = (nav: Navigator): boolean =>
  /iPhone|iPad|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1)

/** Which fullscreen, if any, this browser can give a standalone page. */
export function fullscreenSupport(doc: Document, nav: Navigator): FullscreenSupport {
  // Opened from the Home Screen, the game already has the whole screen.
  if (isIos(nav))
    return (nav as Navigator & { standalone?: boolean }).standalone === true ? 'none' : 'ios-home-screen'
  if (doc.fullscreenEnabled && typeof doc.documentElement.requestFullscreen === 'function') return 'element'
  return 'none'
}

export function isFullscreen(doc: Document): boolean {
  return doc.fullscreenElement != null
}

/** Hears fullscreen being entered or left, by the page or the player. Returns the unsubscribe. */
export function onFullscreenChange(doc: Document, listener: () => void): () => void {
  doc.addEventListener('fullscreenchange', listener)
  return () => doc.removeEventListener('fullscreenchange', listener)
}

type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> }

/**
 * Enters element fullscreen, then asks for a landscape lock, which most phones refuse outside an installed app. A
 * refusal of either changes nothing: the game plays in the window (M4 spec §6).
 */
export async function enterFullscreen(doc: Document, screen?: Screen): Promise<void> {
  await doc.documentElement.requestFullscreen().catch(() => undefined)
  await (screen?.orientation as LockableOrientation | undefined)?.lock?.('landscape').catch(() => undefined)
}
