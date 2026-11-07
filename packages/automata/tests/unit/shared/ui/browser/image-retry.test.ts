import { afterEach, describe, expect, it, vi } from 'vitest'
import { RETRY_DELAYS_MS, retryUrl, watchImage } from '#src/shared/ui/browser/image-retry.ts'

type Probe = { src: string; onerror: (() => void) | null }
let probes: Probe[] = []

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  probes = []
})

/** Fails the request the probe at `index` made, as a dropped request would. */
function fail(index: number): void {
  const onerror = probes.at(index)?.onerror
  if (onerror === null || onerror === undefined) throw new Error(`no pending probe at ${index}`)
  onerror()
}

function stubImage(): void {
  vi.stubGlobal(
    'Image',
    class {
      src = ''
      onerror: (() => void) | null = null
      constructor() {
        probes.push(this)
      }
    },
  )
}

describe('image retry', () => {
  it('asks for each retry on a URL of its own', () => {
    expect(retryUrl('/a.png', 0)).toBe('/a.png')
    expect(retryUrl('/a.png', 2)).toBe('/a.png?retry=2')
    expect(retryUrl('/a.png?v=1', 1)).toBe('/a.png?v=1&retry=1')
  })

  it('retries a failed image after each delay, three times, then stops', () => {
    vi.useFakeTimers()
    stubImage()
    const retries: string[] = []
    watchImage('/a.png', (url) => retries.push(url))
    for (const delay of [250, 750, 2000]) {
      fail(-1)
      vi.advanceTimersByTime(delay)
    }
    fail(-1)
    vi.advanceTimersByTime(10_000)
    expect(retries).toEqual(['/a.png?retry=1', '/a.png?retry=2', '/a.png?retry=3'])
    expect(probes.map((probe) => probe.src)).toEqual([
      '/a.png',
      '/a.png?retry=1',
      '/a.png?retry=2',
      '/a.png?retry=3',
    ])
  })

  it('retries nothing once stopped', () => {
    vi.useFakeTimers()
    stubImage()
    const retries: string[] = []
    const stop = watchImage('/a.png', (url) => retries.push(url))
    fail(0)
    stop()
    vi.advanceTimersByTime(10_000)
    expect(retries).toEqual([])
  })

  it('waits 250, 750 and 2000 ms', () => {
    expect(RETRY_DELAYS_MS).toEqual([250, 750, 2000])
  })

  it('uses the timers it is given', () => {
    stubImage()
    const waits: number[] = []
    let pending: (() => void) | undefined
    const timers = {
      setTimeout: (run: () => void, ms: number) => {
        waits.push(ms)
        pending = run
        return 1 as unknown as ReturnType<typeof setTimeout>
      },
      clearTimeout: () => undefined,
    }
    const retries: string[] = []
    watchImage('/a.png', (url) => retries.push(url), timers)
    fail(0)
    pending?.()
    expect(waits).toEqual([250])
    expect(retries).toEqual(['/a.png?retry=1'])
  })
})
