// A workspace and a clock for the app tests: the kit's memory stores, as `openWorkspace` gives when OPFS cannot be
// used, but reporting themselves persistent so the save status behaves as it does with OPFS; and a clock the tests move
// by hand, which drives the stores' mtimes, the autosave debounce and the history's coalescing.
import {
  createDownloadStore,
  createMemoryStore,
  type DownloadFile,
  type StorageClock,
  type Workspace,
} from '@automataframework/automata-editor/kit/core'

export interface TestClock extends StorageClock {
  /** Moves time forward, running every timer that falls due on the way, in order. */
  advance(ms: number): void
}

export function createTestClock(start = 1_700_000_000_000): TestClock {
  let time = start
  let next = 1
  const timers = new Map<number, { due: number; run: () => void }>()
  return {
    now: () => time,
    setTimer(ms, run) {
      const handle = next++
      timers.set(handle, { due: time + ms, run })
      return handle
    },
    clearTimer(handle) {
      timers.delete(handle as number)
    },
    advance(ms) {
      const target = time + ms
      for (;;) {
        let soonest: [number, { due: number; run: () => void }] | undefined
        for (const entry of timers) {
          if (entry[1].due <= target && (soonest === undefined || entry[1].due < soonest[1].due))
            soonest = entry
        }
        if (soonest === undefined) break
        timers.delete(soonest[0])
        time = soonest[1].due
        soonest[1].run()
      }
      time = target
    },
  }
}

export interface MemoryWorkspace extends Workspace {
  /** What Export downloaded, in order. */
  readonly downloads: readonly DownloadFile[]
}

export function memoryWorkspace(clock: StorageClock): MemoryWorkspace {
  const downloads: DownloadFile[] = []
  return {
    store: createMemoryStore({ now: clock.now }),
    journal: createMemoryStore({ now: clock.now }),
    exports: createDownloadStore({ now: clock.now, download: (file) => downloads.push(file) }),
    persistent: true,
    reason: undefined,
    downloads,
  }
}

export const textOf = (bytes: Uint8Array | undefined): string | undefined =>
  bytes === undefined ? undefined : new TextDecoder().decode(bytes)
