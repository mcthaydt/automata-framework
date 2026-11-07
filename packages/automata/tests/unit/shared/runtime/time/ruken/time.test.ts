import { describe, expect, it } from 'vitest'
import { createPresentationBus } from '#src/shared/runtime/presentation/presentation-bus.manager.ts'
import { createTime, watchLifecycle } from '#src/shared/runtime/time/time.manager.ts'
import { withHostingTest } from '#src/testing/host/page/ruken/hosting-test.ts'
import { settle } from '#src/testing/settle.ts'

const drive = async (step: () => unknown): Promise<void> => {
  await step()
  await settle()
}

describe('Time and watchLifecycle', () => {
  it("pause('menu') makes paused true and reasons {menu}; resume('menu') clears it; with both reasons held, resuming one keeps it paused", async () => {
    const bus = createPresentationBus()
    const time = createTime(bus)

    expect(time.paused).toBe(false)
    expect([...time.reasons]).toEqual([])

    time.pause('menu')
    expect(time.paused).toBe(true)
    expect([...time.reasons]).toEqual(['menu'])

    time.pause('lifecycle')
    expect(time.paused).toBe(true)
    expect(new Set(time.reasons)).toEqual(new Set(['menu', 'lifecycle']))

    time.resume('menu')
    expect(time.paused).toBe(true)
    expect([...time.reasons]).toEqual(['lifecycle'])

    time.resume('lifecycle')
    expect(time.paused).toBe(false)
    expect([...time.reasons]).toEqual([])
  })

  it("holds the 'input' reason for a pad unplugged in play (M4-D9)", async () => {
    const time = createTime(createPresentationBus())
    time.pause('input')
    time.pause('menu')
    time.resume('menu')
    expect([...time.reasons]).toEqual(['input'])
    time.resume('input')
    expect(time.paused).toBe(false)
  })

  it("holds the 'display' reason for a phone held the wrong way (M4.7)", async () => {
    const time = createTime(createPresentationBus())
    time.pause('display')
    time.pause('menu')
    time.resume('menu')
    expect([...time.reasons]).toEqual(['display'])
    time.resume('display')
    expect(time.paused).toBe(false)
  })

  it('time.changed is published on the bus each time paused flips, and not when a second reason is added', async () => {
    const bus = createPresentationBus()
    const time = createTime(bus)

    const events: boolean[] = []
    bus.subscribe('time.changed', (fact) => {
      events.push(fact.paused)
    })

    // Flip from false -> true
    time.pause('menu')
    expect(events).toEqual([true])

    // Second pause reason: paused is still true, so time.changed does not publish
    time.pause('lifecycle')
    expect(events).toEqual([true])

    // Resume one reason: paused is still true
    time.resume('menu')
    expect(events).toEqual([true])

    // Resume last reason: paused flips to false
    time.resume('lifecycle')
    expect(events).toEqual([true, false])
  })

  it("under pauseBehavior: 'pause', the host going to background adds lifecycle; coming back removes it", async () => {
    await withHostingTest(async ({ hosting, handle: { host } }) => {
      const time = createTime(createPresentationBus())
      const stop = watchLifecycle({ hosting, time, pauseBehavior: 'pause', openMenu: () => {} })

      await drive(() => undefined)
      expect(time.reasons.has('lifecycle')).toBe(false)

      await drive(() => host.frame?.hostDocument.setVisibility('hidden'))
      expect(time.reasons.has('lifecycle')).toBe(true)

      await drive(() => host.frame?.hostDocument.setVisibility('visible'))
      expect(time.reasons.has('lifecycle')).toBe(false)
      stop()
    })
  })

  it("under pauseBehavior: 'continue' the same does nothing", async () => {
    await withHostingTest(async ({ hosting, handle: { host } }) => {
      const time = createTime(createPresentationBus())
      const stop = watchLifecycle({ hosting, time, pauseBehavior: 'continue', openMenu: () => {} })

      await drive(() => undefined)
      await drive(() => host.frame?.hostDocument.setVisibility('hidden'))
      expect(time.reasons.has('lifecycle')).toBe(false)
      expect(time.paused).toBe(false)
      stop()
    })
  })

  it('a hidden document pauses a standalone session (the injected document visibilityState and its visibilitychange event)', async () => {
    await withHostingTest(
      async ({ hosting }) => {
        const time = createTime(createPresentationBus())

        let visibilityState: DocumentVisibilityState = 'visible'
        const listeners = new Set<() => void>()
        const fakeDocument = {
          get visibilityState() {
            return visibilityState
          },
          addEventListener: (_type: string, listener: () => void) => {
            listeners.add(listener)
          },
          removeEventListener: (_type: string, listener: () => void) => {
            listeners.delete(listener)
          },
        } as unknown as Document

        const stop = watchLifecycle({
          hosting,
          time,
          pauseBehavior: 'pause',
          document: fakeDocument,
          openMenu: () => {},
        })

        visibilityState = 'hidden'
        for (const l of listeners) l()
        expect(time.reasons.has('lifecycle')).toBe(true)

        visibilityState = 'visible'
        for (const l of listeners) l()
        expect(time.reasons.has('lifecycle')).toBe(false)

        stop()
        expect(listeners.size).toBe(0)
      },
      { env: (env) => ({ ...env, isTopLevel: true }) },
    )
  })

  it("entering background under 'pause' calls openMenu once, and play does not resume on its own when the host comes back", async () => {
    await withHostingTest(async ({ hosting, handle: { host } }) => {
      const time = createTime(createPresentationBus())
      let openMenuCalls = 0
      const openMenu = () => {
        openMenuCalls++
        time.pause('menu')
      }
      const stop = watchLifecycle({ hosting, time, pauseBehavior: 'pause', openMenu })

      await drive(() => undefined)
      expect(openMenuCalls).toBe(0)

      await drive(() => host.frame?.hostDocument.setVisibility('hidden'))
      expect(openMenuCalls).toBe(1)
      expect(time.reasons.has('lifecycle')).toBe(true)
      expect(time.reasons.has('menu')).toBe(true)

      await drive(() => host.frame?.hostDocument.setVisibility('visible'))
      expect(time.reasons.has('lifecycle')).toBe(false)
      expect(time.reasons.has('menu')).toBe(true)
      expect(time.paused).toBe(true) // play does not resume on its own

      time.resume('menu')
      expect(time.paused).toBe(false)
      stop()
    })
  })

  it('stopping the watcher stops it (a later background changes nothing)', async () => {
    await withHostingTest(async ({ hosting, handle: { host } }) => {
      const time = createTime(createPresentationBus())
      const stop = watchLifecycle({ hosting, time, pauseBehavior: 'pause', openMenu: () => {} })

      await drive(() => undefined)
      await drive(() => host.frame?.hostDocument.setVisibility('hidden'))
      expect(time.reasons.has('lifecycle')).toBe(true)

      await drive(() => host.frame?.hostDocument.setVisibility('visible'))
      expect(time.reasons.has('lifecycle')).toBe(false)

      stop()

      await drive(() => host.frame?.hostDocument.setVisibility('hidden'))
      expect(time.reasons.has('lifecycle')).toBe(false)
    })
  })
})
