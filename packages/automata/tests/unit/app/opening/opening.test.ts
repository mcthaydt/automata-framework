import { describe, expect, it, vi } from 'vitest'
import { type OpeningContext, type OpeningStep, runOpening } from '#src/app/opening/opening.ts'
import { createSeenFlags, SEEN_KEY } from '#src/app/opening/seen-flags.ts'
import type { DeviceStorage } from '#src/shared/runtime/settings/device-storage.ts'

// The opening sequence: steps that run after the host is ready and before the first screen. An opening never blocks
// play, so a step that throws is skipped; the seen flags are one device-storage record, and a device whose storage is
// blocked still gets every first-run screen, once per visit.

function memoryStorage(
  initial: Record<string, string> = {},
): DeviceStorage & { readonly values: Map<string, string> } {
  const values = new Map(Object.entries(initial))
  return {
    values,
    get: (key) => values.get(key) ?? null,
    set: (key, value) => void values.set(key, value),
    remove: (key) => void values.delete(key),
  }
}

const context = (signal = new AbortController().signal): Omit<OpeningContext, 'layer'> => ({
  services: {} as OpeningContext['services'],
  seen: createSeenFlags(undefined),
  signal,
})

describe('runOpening', () => {
  it('runs the steps in order, each in its own layer, removed after', async () => {
    const overlay = document.createElement('div')
    const seen: string[] = []
    const step =
      (name: string): OpeningStep =>
      async ({ layer }) => {
        seen.push(`${name}:${layer.parentElement === overlay}:${overlay.children.length}`)
        await Promise.resolve()
      }
    await runOpening([step('a'), step('b')], context(), overlay, () => {})
    expect(seen).toEqual(['a:true:1', 'b:true:1'])
    expect(overlay.children.length).toBe(0)
  })

  it('skips a step that throws and still runs the next, saying so once', async () => {
    const warn = vi.fn()
    const ran: string[] = []
    const overlay = document.createElement('div')
    await runOpening(
      [
        () => {
          throw new Error('boom')
        },
        async () => void ran.push('next'),
      ],
      context(),
      overlay,
      warn,
    )
    expect(ran).toEqual(['next'])
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]?.[0]).toContain('boom')
    expect(overlay.children.length).toBe(0)
  })

  it('ends at once when the signal is aborted, without starting the steps after it', async () => {
    const abort = new AbortController()
    const ran: string[] = []
    const overlay = document.createElement('div')
    await runOpening(
      [
        async () => {
          ran.push('first')
          abort.abort()
        },
        async () => void ran.push('second'),
      ],
      context(abort.signal),
      overlay,
      () => {},
    )
    expect(ran).toEqual(['first'])
  })

  it('runs nothing and resolves for no steps', async () => {
    await expect(runOpening([], context(), document.createElement('div'), () => {})).resolves.toBeUndefined()
  })
})

describe('createSeenFlags', () => {
  it('starts with nothing seen', () => {
    const flags = createSeenFlags(memoryStorage())
    expect([flags.has('language'), flags.has('photosensitivity')]).toEqual([false, false])
  })

  it('survives a new createSeenFlags over the same storage', () => {
    const storage = memoryStorage()
    createSeenFlags(storage).mark('language')
    const again = createSeenFlags(storage)
    expect([again.has('language'), again.has('photosensitivity')]).toEqual([true, false])
    expect(JSON.parse(storage.values.get(SEEN_KEY) ?? '{}')).toEqual({
      language: true,
      photosensitivity: false,
    })
  })

  it('keeps every flag when another is marked', () => {
    const storage = memoryStorage()
    const flags = createSeenFlags(storage)
    flags.mark('language')
    flags.mark('photosensitivity')
    expect(createSeenFlags(storage).has('language')).toBe(true)
    expect(createSeenFlags(storage).has('photosensitivity')).toBe(true)
  })

  it('answers has() for this visit when the storage throws on set, and never throws', () => {
    const blocked: DeviceStorage = {
      get: () => {
        throw new Error('blocked')
      },
      set: () => {
        throw new Error('blocked')
      },
      remove: () => {},
    }
    const flags = createSeenFlags(blocked)
    expect(flags.has('language')).toBe(false)
    expect(() => flags.mark('language')).not.toThrow()
    expect(flags.has('language')).toBe(true)
  })

  it('keeps the flags for the visit only when there is no storage at all', () => {
    const flags = createSeenFlags(undefined)
    flags.mark('photosensitivity')
    expect(flags.has('photosensitivity')).toBe(true)
    expect(createSeenFlags(undefined).has('photosensitivity')).toBe(false)
  })

  it.each([['{"language":"yes"}'], ['not json'], ['null'], ['[]']])('reads %j as nothing seen', (raw) => {
    const flags = createSeenFlags(memoryStorage({ [SEEN_KEY]: raw }))
    expect([flags.has('language'), flags.has('photosensitivity')]).toEqual([false, false])
  })

  it('reads a field that is fine even when another is garbage', () => {
    const flags = createSeenFlags(memoryStorage({ [SEEN_KEY]: '{"language":true,"photosensitivity":3}' }))
    expect([flags.has('language'), flags.has('photosensitivity')]).toEqual([true, false])
  })
})
