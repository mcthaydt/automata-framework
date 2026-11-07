/**
 * The small pure parts of the room's connection handling: what a close code means, how a call is given up, and how a
 * wait for the server is bounded. None of them touches the room's state.
 */

import type { Clock } from '@automata/framework'
import type { RoomEnd } from './room-api'
import type { NetSdkRoom } from './sdk'

/** A resume the server never answered within the grace: read as `OFFLINE`. */
export const NO_ANSWER: unique symbol = Symbol('no answer')

/** What a close code means; undefined is a drop. */
export function endOf(code: number): RoomEnd['reason'] | undefined {
  switch (code) {
    case 1000:
    case 4000:
      return 'closed'
    case 4001:
      return 'server-updating'
    case 4002:
      return 'failed'
    default:
      return undefined
  }
}

/** Leaves `room` (consented) and ignores any failure: for a room nobody holds. */
export const quietly = (room: NetSdkRoom | undefined): void => {
  void room?.leave(true).catch(() => undefined)
}

/**
 * `work`, unless `signal` aborts first: then `onAbort` runs and the result rejects with the signal's reason. Whatever
 * `work` does later is ignored here (the caller's own generation check retires a room that arrives late).
 */
export function abortable<T>(
  signal: AbortSignal | undefined,
  work: Promise<T>,
  onAbort: () => void,
): Promise<T> {
  if (signal === undefined) return work
  return new Promise<T>((resolve, reject) => {
    const abort = (): void => {
      onAbort()
      reject(signal.reason)
    }
    signal.addEventListener('abort', abort, { once: true })
    work.then(
      (value) => {
        signal.removeEventListener('abort', abort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort)
        reject(error)
      },
    )
  })
}

/** `work`, or `NO_ANSWER` if it has not settled within `ms` on `clock`. */
export const within = <T>(clock: Clock, work: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = clock.setTimeout(() => reject(NO_ANSWER), ms)
    work.then(
      (value) => {
        clock.clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clock.clearTimeout(timer)
        reject(error)
      },
    )
  })
