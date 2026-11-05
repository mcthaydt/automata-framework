import type { Clock } from '../../shared/lib/clock'

/**
 * What the game does when the host closes it.
 *
 * `Ruken.init` calls every `exiting` listener at once and answers the host when all have returned, so a game's last
 * write and the host flush would race: the flush can leave before the write reaches the SDK's outbox. AF registers
 * one SDK listener and runs, in this order, the handlers screens and services registered (registration order), then
 * `last` (the host flush), all inside one `cap`. The host is answered when that is done or the cap passes,
 * whichever is first.
 *
 * A handler that fails is logged and the next one still runs. A handler that never returns uses up the cap, so the
 * steps after it are skipped; the host is still answered in time.
 */
export interface ExitHandlers {
  /** Runs `handler` on exit until the returned function takes it back. */
  register(handler: () => void | Promise<void>): () => void
  /** Runs the registered handlers in order, then `last`, within the cap. Never rejects. */
  run(last: () => void | Promise<void>): Promise<void>
}

interface Registration {
  readonly handler: () => void | Promise<void>
  /** Set when the handler is taken back, including while an exit is already running. */
  released: boolean
}

export function makeExitHandlers(capMs: number, clock: Clock): ExitHandlers {
  const registrations: Registration[] = []

  const guarded = async (step: () => void | Promise<void>): Promise<void> => {
    try {
      await step()
    } catch (cause) {
      console.warn('An exiting handler failed', cause)
    }
  }

  return {
    register(handler) {
      const registration: Registration = { handler, released: false }
      registrations.push(registration)
      return () => {
        registration.released = true
        const index = registrations.indexOf(registration)
        if (index >= 0) registrations.splice(index, 1)
      }
    },

    async run(last) {
      // A copy, so a handler taken back during the exit cannot shift the walk.
      const walk = (async () => {
        for (const registration of [...registrations]) {
          if (!registration.released) await guarded(registration.handler)
        }
        await guarded(last)
      })()
      let timer: unknown
      const capped = new Promise<void>((resolve) => {
        timer = clock.setTimeout(resolve, capMs)
      })
      await Promise.race([walk, capped])
      clock.clearTimeout(timer)
    },
  }
}
