// The connection badge and the reconnect overlay as one state machine over `ConnectionState` and time (M7 spec §7). Pure: the
// component feeds it the state and the time and draws what it answers.
//
//   offline            badge hidden
//   connecting         badge "connecting"
//   connected          badge "connected" for two seconds after the connection came up (or a degraded one cleared), then hidden
//   degraded           badge "degraded" for as long as it lasts
//   reconnecting       badge "reconnecting" with the seconds left; the overlay counts down; once the grace has passed the overlay
//                      says it could not reconnect and offers Leave, and the badge hides (the overlay has the player's attention)
import type { ConnectionState } from '../client/net-room'

export const CONNECTED_SHOWN_MS = 2000

export type BadgeState = 'hidden' | 'connecting' | 'connected' | 'reconnecting' | 'degraded'
export type OverlayState = 'hidden' | 'reconnecting' | 'expired'
export interface NetStatusView {
  readonly badge: BadgeState
  readonly overlay: OverlayState
  /** Seconds of grace left while reconnecting; undefined otherwise. */
  readonly secondsLeft: number | undefined
}

export interface NetStatus {
  /** The view for `state` at time `now` (ms). Call it when the state changes and as time passes. */
  update(state: ConnectionState, now: number): NetStatusView
}

const HIDDEN: NetStatusView = { badge: 'hidden', overlay: 'hidden', secondsLeft: undefined }

export function createNetStatus(options: { readonly graceSeconds: number }): NetStatus {
  let last: ConnectionState = 'offline'
  let since = 0
  return {
    update(state, now) {
      if (state !== last) {
        last = state
        since = now
      }
      switch (state) {
        case 'offline':
          return HIDDEN
        case 'connecting':
          return { ...HIDDEN, badge: 'connecting' }
        case 'connected':
          return now - since < CONNECTED_SHOWN_MS ? { ...HIDDEN, badge: 'connected' } : HIDDEN
        case 'degraded':
          return { ...HIDDEN, badge: 'degraded' }
        case 'reconnecting': {
          const left = Math.max(0, Math.ceil(options.graceSeconds - (now - since) / 1000))
          if (left === 0) return { badge: 'hidden', overlay: 'expired', secondsLeft: 0 }
          return { badge: 'reconnecting', overlay: 'reconnecting', secondsLeft: left }
        }
      }
    },
  }
}
