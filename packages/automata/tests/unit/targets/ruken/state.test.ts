import type { DisplayMetricsPayload } from '@ruken/sdk'
import { settle } from '@ruken/sdk-host/testing'
import { Chunk, Effect, Fiber, Stream, type Subscribable } from 'effect'
import { describe, expect, it } from 'vitest'
import { Hosting } from '#src/shared/host/hosting.ts'
import { FakeHostHandle, HostingTest, runScoped } from '#src/testing/host/page/index.ts'

/** Starts reading the first `count` values of `changes` (the current value, then changes). */
const firstValues = <A>(observed: Subscribable.Subscribable<A>, count: number) =>
  Effect.fork(observed.changes.pipe(Stream.take(count), Stream.runCollect, Effect.map(Chunk.toReadonlyArray)))

const drive = (step: () => unknown): Effect.Effect<void> =>
  Effect.promise(async () => {
    await step()
    await settle()
  })

const metrics = (edge: 'left' | 'right', width: number, fullscreen = false): DisplayMetricsPayload => ({
  safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
  hostReserved: { edge, rect: { x: 0, y: 0, w: width, h: 120 } },
  orientation: 'landscape',
  fullscreen,
  scale: 1,
})

describe('observed host state: the current value, then each change (shared contracts §1.5)', () => {
  it("display follows the host's metrics, including the reserved edge (FloorFifty host-reserved)", async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        const welcome = host.messages.find((entry) => entry.msg.type === 'welcome')?.msg.payload as {
          display: DisplayMetricsPayload
        }
        expect(yield* hosting.display.get).toEqual(welcome.display)

        const seen = yield* firstValues(hosting.display, 3)
        yield* drive(() => undefined)
        yield* drive(() => host.bridge.setMetrics(metrics('right', 64)))
        yield* drive(() => host.bridge.setMetrics(metrics('left', 40, true)))
        const values = yield* Fiber.join(seen)
        expect(values.map((value) => [value.hostReserved.edge, value.hostReserved.rect.w])).toEqual([
          [welcome.display.hostReserved.edge, welcome.display.hostReserved.rect.w],
          ['right', 64],
          ['left', 40],
        ])
        expect((yield* hosting.display.get).fullscreen).toBe(true)
      }).pipe(Effect.provide(HostingTest())),
    )
  })

  it("audio gain follows the host's master volume and mute (FloorFifty audio-host-gain)", async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        const seen = yield* firstValues(hosting.audio, 4)
        yield* drive(() => undefined)
        yield* drive(() => host.bridge.setMasterAudio(0.5, false))
        yield* drive(() => host.bridge.setMasterAudio(0.5, true))
        yield* drive(() => host.bridge.setMasterAudio(1, false))
        const gains = (yield* Fiber.join(seen)).map((change) => change.gain)
        expect(gains[0]).toBe(1)
        expect(gains[1]).toBeCloseTo(0.5)
        expect(gains.slice(2)).toEqual([0, 1])
      }).pipe(Effect.provide(HostingTest())),
    )
  })

  it("audio drops to silence under the host's ad and comes back after it", async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        yield* drive(() => host.bridge.setOverlay('ad'))
        expect((yield* hosting.audio.get).gain).toBe(0)
        yield* drive(() => host.bridge.setOverlay('none'))
        expect((yield* hosting.audio.get).gain).toBe(1)
      }).pipe(Effect.provide(HostingTest())),
    )
  })

  it('lifecycle goes to background when the host page is hidden and back when shown (FloorFifty sleep-hosted)', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        const seen = yield* firstValues(hosting.lifecycle, 3)
        yield* drive(() => undefined)
        yield* drive(() => host.frame?.hostDocument.setVisibility('hidden'))
        yield* drive(() => host.frame?.hostDocument.setVisibility('visible'))
        const states = (yield* Fiber.join(seen)).map((change) => change.state)
        expect(states).toEqual(['active', 'background', 'active'])
      }).pipe(Effect.provide(HostingTest())),
    )
  })

  it("lifecycle reports the host's own drawer as a reason, as the SDK sends it", async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        yield* drive(() => host.bridge.setOverlay('drawer'))
        expect((yield* hosting.lifecycle.get).reasons).toContain('host-overlay')
      }).pipe(Effect.provide(HostingTest())),
    )
  })

  it('input follows the host input mode', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        const seen = yield* firstValues(hosting.input, 2)
        yield* drive(() => undefined)
        yield* drive(() =>
          host.bridge.setInputMode({ mode: 'gamepad', gamepad: { layout: 'xbox', connected: true } }),
        )
        const modes = (yield* Fiber.join(seen)).map((change) => change.mode)
        expect(modes[1]).toBe('gamepad')
      }).pipe(Effect.provide(HostingTest())),
    )
  })

  it('entitlements follow a server push', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        expect((yield* hosting.entitlements.get).ads).toBe(false)
        const seen = yield* firstValues(hosting.entitlements, 2)
        yield* drive(() => undefined)
        yield* drive(() => host.fakes.entitlement.set({ ads: true }))
        const values = yield* Fiber.join(seen)
        expect(values.map((value) => value.ads)).toEqual([false, true])
      }).pipe(Effect.provide(HostingTest())),
    )
  })
})
