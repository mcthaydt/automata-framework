import { type GestureClock, realClock } from '../gestures/gesture-clock'

// The editor's toast queue (kit spec §4.6): a store, so the editor pushes from anywhere, with its timers taken from
// an injected clock so expiry is tested without waiting. It is a Svelte store (`subscribe` calls back at once with
// the current list), so a component can read it as `$toasts`; `ToastRegion` draws it.

export type ToastKind = 'info' | 'ok' | 'warn' | 'error'

export interface ToastAction {
  readonly label: string
  readonly run: () => void
}

export interface ToastInput {
  /** Defaults to `info`. */
  readonly kind?: ToastKind | undefined
  readonly message: string
  readonly action?: ToastAction | undefined
  /** Milliseconds on screen: 5000, or 8000 with an action. 0 stays until dismissed. */
  readonly duration?: number | undefined
}

export interface Toast {
  readonly id: string
  readonly kind: ToastKind
  readonly message: string
  readonly action?: ToastAction
  readonly duration: number
}

export interface ToastStore {
  /** Adds a toast and returns its id. A fourth toast drops the oldest. */
  push(toast: ToastInput): string
  dismiss(id: string): void
  /** Runs the toast's action, then dismisses it. */
  activate(id: string): void
  readonly items: readonly Toast[]
  /** Calls `run` now and after every change; returns the unsubscribe. */
  subscribe(run: (items: readonly Toast[]) => void): () => void
}

export interface ToastOptions {
  readonly clock?: GestureClock | undefined
}

const MAX_TOASTS = 3
const DURATION = 5000
const DURATION_WITH_ACTION = 8000

export function createToasts(options: ToastOptions = {}): ToastStore {
  const clock = options.clock ?? realClock
  let items: readonly Toast[] = []
  let counter = 0
  const timers = new Map<string, unknown>()
  const subscribers = new Set<(items: readonly Toast[]) => void>()

  const publish = (next: readonly Toast[]): void => {
    items = next
    for (const run of subscribers) run(items)
  }

  function stopTimer(id: string): void {
    if (!timers.has(id)) return
    clock.clearTimer(timers.get(id))
    timers.delete(id)
  }

  function dismiss(id: string): void {
    if (!items.some((toast) => toast.id === id)) return
    stopTimer(id)
    publish(items.filter((toast) => toast.id !== id))
  }

  return {
    push(input) {
      const id = `toast-${++counter}`
      const duration = input.duration ?? (input.action ? DURATION_WITH_ACTION : DURATION)
      const toast: Toast = {
        id,
        kind: input.kind ?? 'info',
        message: input.message,
        ...(input.action ? { action: input.action } : {}),
        duration,
      }
      const kept = items.slice(-(MAX_TOASTS - 1))
      for (const dropped of items.slice(0, items.length - kept.length)) stopTimer(dropped.id)
      publish([...kept, toast])
      if (duration > 0)
        timers.set(
          id,
          clock.setTimer(duration, () => dismiss(id)),
        )
      return id
    },
    dismiss,
    activate(id) {
      const toast = items.find((candidate) => candidate.id === id)
      if (toast === undefined) return
      toast.action?.run()
      dismiss(id)
    },
    get items() {
      return items
    },
    subscribe(run) {
      subscribers.add(run)
      run(items)
      return () => {
        subscribers.delete(run)
      }
    },
  }
}
