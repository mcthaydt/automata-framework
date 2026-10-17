import { Hosting } from '@mcthaydt/automata-host'
import { FakeHostHandle, HostingTest, runScoped } from '@mcthaydt/automata-host/testing'
import { settle } from '@ruken/sdk-host/testing'
import { Effect, Exit, Scope } from 'effect'
import { describe, expect, it } from 'vitest'
import { makePresentationBus } from '../presentation/presentation-bus.manager.js'
import { makeTime, watchLifecycle } from './time.manager.js'

const drive = (step: () => unknown): Effect.Effect<void> =>
  Effect.promise(async () => {
    await step()
    await settle()
  })

describe('Time and watchLifecycle', () => {
  it("pause('menu') makes paused true and reasons {menu}; resume('menu') clears it; with both reasons held, resuming one keeps it paused", async () => {
    await runScoped(
      Effect.gen(function* () {
        const bus = yield* makePresentationBus()
        const time = makeTime(bus)

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
      }),
    )
  })

  it("holds the 'input' reason for a pad unplugged in play (M4-D9)", async () => {
    await runScoped(
      Effect.gen(function* () {
        const time = makeTime(yield* makePresentationBus())
        time.pause('input')
        time.pause('menu')
        time.resume('menu')
        expect([...time.reasons]).toEqual(['input'])
        time.resume('input')
        expect(time.paused).toBe(false)
      }),
    )
  })

  it('time.changed is published on the bus each time paused flips, and not when a second reason is added', async () => {
    await runScoped(
      Effect.gen(function* () {
        const bus = yield* makePresentationBus()
        const time = makeTime(bus)

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
      }),
    )
  })

  it("under pauseBehavior: 'pause', the host going to background adds lifecycle; coming back removes it", async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        const bus = yield* makePresentationBus()
        const time = makeTime(bus)

        yield* watchLifecycle({
          hosting,
          time,
          pauseBehavior: 'pause',
          openMenu: () => {},
        })

        yield* drive(() => undefined)
        expect(time.reasons.has('lifecycle')).toBe(false)

        yield* drive(() => host.frame?.hostDocument.setVisibility('hidden'))
        expect(time.reasons.has('lifecycle')).toBe(true)

        yield* drive(() => host.frame?.hostDocument.setVisibility('visible'))
        expect(time.reasons.has('lifecycle')).toBe(false)
      }).pipe(Effect.provide(HostingTest())),
    )
  })

  it("under pauseBehavior: 'continue' the same does nothing", async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        const bus = yield* makePresentationBus()
        const time = makeTime(bus)

        yield* watchLifecycle({
          hosting,
          time,
          pauseBehavior: 'continue',
          openMenu: () => {},
        })

        yield* drive(() => undefined)
        yield* drive(() => host.frame?.hostDocument.setVisibility('hidden'))
        expect(time.reasons.has('lifecycle')).toBe(false)
        expect(time.paused).toBe(false)
      }).pipe(Effect.provide(HostingTest())),
    )
  })

  it('a hidden document pauses a standalone session (the injected document visibilityState and its visibilitychange event)', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const bus = yield* makePresentationBus()
        const time = makeTime(bus)

        // Mock document with visibilityState and dispatchEvent
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

        yield* watchLifecycle({
          hosting,
          time,
          pauseBehavior: 'pause',
          document: fakeDocument,
          openMenu: () => {},
        })

        // Simulate tab hidden
        visibilityState = 'hidden'
        for (const l of listeners) l()
        expect(time.reasons.has('lifecycle')).toBe(true)

        // Simulate tab visible
        visibilityState = 'visible'
        for (const l of listeners) l()
        expect(time.reasons.has('lifecycle')).toBe(false)
      }).pipe(
        Effect.provide(
          HostingTest({
            env: (env) => ({ ...env, isTopLevel: true }),
          }),
        ),
      ),
    )
  })

  it("entering background under 'pause' calls openMenu once, and play does not resume on its own when the host comes back", async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        const bus = yield* makePresentationBus()
        const time = makeTime(bus)

        let openMenuCalls = 0
        const openMenu = () => {
          openMenuCalls++
          time.pause('menu')
        }

        yield* watchLifecycle({
          hosting,
          time,
          pauseBehavior: 'pause',
          openMenu,
        })

        yield* drive(() => undefined)
        expect(openMenuCalls).toBe(0)

        // Background: should call openMenu and add lifecycle
        yield* drive(() => host.frame?.hostDocument.setVisibility('hidden'))
        expect(openMenuCalls).toBe(1)
        expect(time.reasons.has('lifecycle')).toBe(true)
        expect(time.reasons.has('menu')).toBe(true)

        // Host returns to visible: lifecycle removed, but menu remains
        yield* drive(() => host.frame?.hostDocument.setVisibility('visible'))
        expect(time.reasons.has('lifecycle')).toBe(false)
        expect(time.reasons.has('menu')).toBe(true)
        expect(time.paused).toBe(true) // play does not resume on its own

        // Game resumes menu
        time.resume('menu')
        expect(time.paused).toBe(false)
      }).pipe(Effect.provide(HostingTest())),
    )
  })

  it('closing the watcher scope stops it (a later background changes nothing)', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        const bus = yield* makePresentationBus()
        const time = makeTime(bus)

        const childScope = yield* Scope.make()
        yield* watchLifecycle({
          hosting,
          time,
          pauseBehavior: 'pause',
          openMenu: () => {},
        }).pipe(Scope.extend(childScope))

        yield* drive(() => undefined)
        yield* drive(() => host.frame?.hostDocument.setVisibility('hidden'))
        expect(time.reasons.has('lifecycle')).toBe(true)

        yield* drive(() => host.frame?.hostDocument.setVisibility('visible'))
        expect(time.reasons.has('lifecycle')).toBe(false)

        // Close watcher scope
        yield* Scope.close(childScope, Exit.void)

        // Later background changes nothing
        yield* drive(() => host.frame?.hostDocument.setVisibility('hidden'))
        expect(time.reasons.has('lifecycle')).toBe(false)
      }).pipe(Effect.provide(HostingTest())),
    )
  })
})
