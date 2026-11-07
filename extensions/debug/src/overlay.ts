// The overlay's state and its dev-input rules, apart from any view. A dev key (backquote) or a three-finger tap toggles it and
// Escape closes it; opening it pauses nothing. The "pause sim" toggle goes out through the port the game gives (Flow's pause).
import type { DebugPanelDef } from './panels'

export interface OverlayState {
  readonly open: boolean
  /** The shown panel's id; null when there are no panels. */
  readonly tab: string | null
  readonly paused: boolean
}
export interface OverlayOptions {
  readonly panels: readonly DebugPanelDef[]
  readonly setPaused?: ((paused: boolean) => void) | undefined
}
export interface Overlay {
  state(): OverlayState
  toggle(): void
  close(): void
  select(id: string): void
  setPaused(paused: boolean): void
  /** Returns true when the key was the overlay's (the caller then stops it reaching the game). */
  key(key: string): boolean
  /** Returns true when the touch count opened or closed the overlay. */
  touch(fingers: number): boolean
  subscribe(listener: (state: OverlayState) => void): () => void
}

export const DEV_KEY = '`'
export const DEV_TAP_FINGERS = 3

export function createOverlay(options: OverlayOptions): Overlay {
  let state: OverlayState = { open: false, tab: options.panels[0]?.id ?? null, paused: false }
  const listeners = new Set<(state: OverlayState) => void>()
  const change = (next: Partial<OverlayState>): void => {
    state = { ...state, ...next }
    for (const listener of [...listeners]) listener(state)
  }
  const overlay: Overlay = {
    state: () => state,
    toggle: () => change({ open: !state.open }),
    close: () => change({ open: false }),
    select(id) {
      if (options.panels.some((p) => p.id === id)) change({ tab: id })
    },
    setPaused(paused) {
      options.setPaused?.(paused)
      change({ paused })
    },
    key(key) {
      if (key === DEV_KEY) {
        overlay.toggle()
        return true
      }
      if (key === 'Escape' && state.open) {
        overlay.close()
        return true
      }
      return false
    },
    touch(fingers) {
      if (fingers !== DEV_TAP_FINGERS) return false
      overlay.toggle()
      return true
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return overlay
}
