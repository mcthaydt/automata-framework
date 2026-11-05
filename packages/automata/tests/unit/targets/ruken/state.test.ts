import type { DisplayMetricsPayload } from '@ruken/sdk'
import { settle } from '@ruken/sdk-host/testing'
import { describe, expect, it } from 'vitest'
import { withHostingTest } from '#src/testing/host/page/index.ts'

/** Collects what `observed` gives (the current value first) until the test ends. */
function collect<A>(observed: { subscribe(listener: (value: A) => void): () => void }): A[] {
  const values: A[] = []
  observed.subscribe((value) => values.push(value))
  return values
}

/** Runs a host-side step, then lets the host's message reach the game. */
const drive = async (step: () => unknown): Promise<void> => {
  await step()
  await settle()
}

const metrics = (edge: 'left' | 'right', width: number, fullscreen = false): DisplayMetricsPayload => ({
  safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
  hostReserved: { edge, rect: { x: 0, y: 0, w: width, h: 120 } },
  orientation: 'landscape',
  fullscreen,
  scale: 1,
})

describe('observed host state: the current value, then each change (shared contracts §1.5)', () => {
  it("display follows the host's metrics, including the reserved edge (FloorFifty host-reserved)", () =>
    withHostingTest(async ({ hosting, handle: { host } }) => {
      const welcome = host.messages.find((entry) => entry.msg.type === 'welcome')?.msg.payload as {
        display: DisplayMetricsPayload
      }
      expect(hosting.display.get()).toEqual(welcome.display)

      const seen = collect(hosting.display)
      await drive(() => host.bridge.setMetrics(metrics('right', 64)))
      await drive(() => host.bridge.setMetrics(metrics('left', 40, true)))
      expect(seen.map((value) => [value.hostReserved.edge, value.hostReserved.rect.w])).toEqual([
        [welcome.display.hostReserved.edge, welcome.display.hostReserved.rect.w],
        ['right', 64],
        ['left', 40],
      ])
      expect(hosting.display.get().fullscreen).toBe(true)
    }))

  it("audio gain follows the host's master volume and mute (FloorFifty audio-host-gain)", () =>
    withHostingTest(async ({ hosting, handle: { host } }) => {
      const seen = collect(hosting.audio)
      await drive(() => host.bridge.setMasterAudio(0.5, false))
      await drive(() => host.bridge.setMasterAudio(0.5, true))
      await drive(() => host.bridge.setMasterAudio(1, false))
      const gains = seen.map((change) => change.gain)
      expect(gains[0]).toBe(1)
      expect(gains[1]).toBeCloseTo(0.5)
      expect(gains.slice(2)).toEqual([0, 1])
    }))

  it("audio drops to silence under the host's ad and comes back after it", () =>
    withHostingTest(async ({ hosting, handle: { host } }) => {
      await drive(() => host.bridge.setOverlay('ad'))
      expect(hosting.audio.get().gain).toBe(0)
      await drive(() => host.bridge.setOverlay('none'))
      expect(hosting.audio.get().gain).toBe(1)
    }))

  it('lifecycle goes to background when the host page is hidden and back when shown (FloorFifty sleep-hosted)', () =>
    withHostingTest(async ({ hosting, handle: { host } }) => {
      const seen = collect(hosting.lifecycle)
      await drive(() => host.frame?.hostDocument.setVisibility('hidden'))
      await drive(() => host.frame?.hostDocument.setVisibility('visible'))
      expect(seen.map((change) => change.state)).toEqual(['active', 'background', 'active'])
    }))

  it("lifecycle reports the host's own drawer as a reason, as the SDK sends it", () =>
    withHostingTest(async ({ hosting, handle: { host } }) => {
      await drive(() => host.bridge.setOverlay('drawer'))
      expect(hosting.lifecycle.get().reasons).toContain('host-overlay')
    }))

  it('input follows the host input mode', () =>
    withHostingTest(async ({ hosting, handle: { host } }) => {
      const seen = collect(hosting.input)
      await drive(() =>
        host.bridge.setInputMode({ mode: 'gamepad', gamepad: { layout: 'xbox', connected: true } }),
      )
      expect(seen.map((change) => change.mode)[1]).toBe('gamepad')
    }))

  it('entitlements follow a server push', () =>
    withHostingTest(async ({ hosting, handle: { host } }) => {
      expect(hosting.entitlements.get().ads).toBe(false)
      const seen = collect(hosting.entitlements)
      await drive(() => host.fakes.entitlement.set({ ads: true }))
      expect(seen.map((value) => value.ads)).toEqual([false, true])
    }))

  it('stops hearing the host once Hosting is disposed', () =>
    withHostingTest(async ({ hosting, handle: { host } }) => {
      const seen = collect(hosting.audio)
      hosting.dispose()
      await drive(() => host.bridge.setMasterAudio(0.25, false))
      expect(seen).toHaveLength(1)
    }))
})
