import { describe, expect, it } from 'vitest'
import type { HostResult } from '#src/shared/host/errors.ts'
import type { HostingOptions } from '#src/shared/host/hosting.ts'
import { HOST_EXIT_CAP_MS, type Hosting } from '#src/shared/host/hosting.ts'
import { fakeClock } from '#src/testing/fake-clock.ts'
import { type FakeHostControl, type FakeHostingOptions, fakeHosting } from '#src/testing/host/index.ts'
import { unwrap } from '#src/testing/unwrap.ts'

const GAME: HostingOptions = { gameId: 'fake-game', wants: ['saves'], pauseBehavior: 'pause' }

/** Runs `program` against a fresh fake host, then disposes it. */
async function withFake<A>(
  options: FakeHostingOptions,
  program: (
    hosting: Hosting,
    control: FakeHostControl,
    clock: ReturnType<typeof fakeClock>,
  ) => Promise<A> | A,
  game: HostingOptions = GAME,
): Promise<A> {
  const fake = fakeHosting(options)
  const clock = fakeClock()
  const hosting = fake.create(game, clock)
  try {
    return await program(hosting, fake.control, clock)
  } finally {
    hosting.dispose()
  }
}

/** One macrotask: lets pending promises finish. */
const tick = (): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('FakeHosting: what each target grants and names (DIST spec §4.3)', () => {
  it.each([
    ['web', 'web', 'this page', ['audio', 'display', 'input', 'lifecycle', 'saves']],
    ['itch', 'web', 'itch.io', ['audio', 'display', 'input', 'lifecycle', 'saves']],
    ['tauri', 'tauri', 'Cinder', ['audio', 'display', 'exit', 'input', 'lifecycle', 'saves']],
    ['ruken', 'ruken', 'Ruken', ['audio', 'display', 'input', 'leaderboards', 'lifecycle', 'saves']],
  ] as const)('the %s target is kind %s, named "%s", and grants %j', (target, kind, hostName, granted) =>
    withFake(
      { target, title: 'Cinder' },
      (hosting) => {
        expect(hosting.kind).toBe(kind)
        expect(hosting.hostName).toBe(hostName)
        expect([...hosting.granted].sort()).toEqual(granted)
      },
      { ...GAME, wants: ['saves', 'leaderboards'] },
    ),
  )

  it.each([
    ['web', 'DENIED'],
    ['itch', 'DENIED'],
    ['tauri', 'DENIED'],
    ['ruken', 'UNSUPPORTED'],
  ] as const)('ungranted saves on %s are refused %s and touch nothing (DIST-d)', (target, code) =>
    withFake({ target, granted: ['lifecycle'], saves: { progress: 'level-1' } }, async (hosting, control) => {
      for (const call of [
        hosting.saves.set('progress', 'level-2'),
        hosting.saves.get('progress'),
        hosting.saves.remove('progress'),
        hosting.saves.flush(),
        hosting.saves.keys(),
      ]) {
        expect(await call).toMatchObject({ ok: false, reason: { code } })
      }
      expect([...control.saved]).toEqual([['progress', 'level-1']])
    }),
  )

  it.each([
    ['web', 'device'],
    ['itch', 'device'],
    ['tauri', 'device'],
    ['ruken', 'host-outbox'],
  ] as const)('a flush on %s says the saves went to %s', (target, persisted) =>
    withFake({ target }, async (hosting) => {
      expect(unwrap(await hosting.saves.flush())).toEqual({ persisted })
    }),
  )

  it('exit is granted on the desktop: it records the reason, runs the exiting handlers, then flushes', () =>
    withFake({ target: 'tauri' }, async (hosting, control) => {
      const ran: string[] = []
      hosting.onExiting(() => void ran.push('handler'))
      control.hold('saves.flush')
      let done = false
      const exiting = hosting.exit('completed').then((result) => {
        done = true
        return result
      })
      await tick()
      // The handler has run and the exit now waits on the held flush.
      expect(ran).toEqual(['handler'])
      expect(done).toBe(false)
      control.release('saves.flush')
      unwrap(await exiting)
      expect(control.exits).toEqual(['completed'])
    }))

  it('exit is refused UNSUPPORTED on the web, where there is nothing to go back to', () =>
    withFake({ target: 'web' }, async (hosting, control) => {
      expect(await hosting.exit()).toMatchObject({
        ok: false,
        reason: { code: 'UNSUPPORTED', operation: 'session.exit' },
      })
      expect(control.exits).toEqual([])
    }))
})

describe('FakeHosting: analytics and consent (DIST spec §8 flow 4)', () => {
  const analytics: HostingOptions = { ...GAME, wants: ['analytics.custom'], disclosedEvents: ['level-up'] }

  it('records a disclosed event where the target grants analytics and the player consented', () =>
    withFake(
      { target: 'ruken' },
      (hosting, control) => {
        hosting.track('level-up', { level: 2 })
        hosting.track('secret')
        expect(control.tracked).toEqual([{ event: 'level-up', props: { level: 2 } }])
      },
      analytics,
    ))

  it('drops every event without consent, and on a target with no analytics', async () => {
    for (const options of [{ target: 'ruken', consent: false }, { target: 'web' }] as const) {
      await withFake(
        options,
        (hosting, control) => {
          hosting.track('level-up')
          expect(control.tracked).toEqual([])
        },
        analytics,
      )
    }
  })
})

describe('FakeHosting: the control handle (DIST spec §7)', () => {
  it('holds ready until welcome() with deferReady', () =>
    withFake({ deferReady: true }, async (hosting, control) => {
      let answered = false
      void hosting.ready.then(() => {
        answered = true
      })
      await tick()
      expect(answered).toBe(false)
      control.welcome()
      expect(await hosting.ready).toEqual({ ok: true, value: undefined })
    }))

  it('refuses ready with failReady(code)', () =>
    withFake({ deferReady: true }, async (hosting, control) => {
      control.failReady('TIMEOUT')
      expect(await hosting.ready).toMatchObject({
        ok: false,
        reason: { code: 'TIMEOUT', operation: 'ready' },
      })
    }))

  it('delivers a pushed change and throws on a payload its schema refuses', () =>
    withFake({}, (hosting, control) => {
      control.push.lifecycle({ state: 'background', reasons: ['hidden'] })
      expect(hosting.lifecycle.get()).toEqual({ state: 'background', reasons: ['hidden'] })
      expect(() => control.push.input({ mode: 'mouse' } as never)).toThrow(/push\.input/)
      expect(hosting.input.get()).toEqual({ mode: 'keyboard-mouse' })
    }))

  it("carries another device's write on saves.changed and into the host's saves", () =>
    withFake({}, async (hosting, control) => {
      const heard: unknown[] = []
      hosting.saves.changed.subscribe((change) => heard.push(change))
      control.push.savesChanged({ key: 'slot', value: 'remote', revision: 2 })
      expect(heard).toEqual([{ key: 'slot', value: 'remote', revision: 2 }])
      expect(unwrap(await hosting.saves.get('slot'))).toBe('remote')
    }))

  it('refuses the next call by name with failNext, then answers again', () =>
    withFake({}, async (hosting, control) => {
      control.failNext('saves.set', 'QUOTA_EXCEEDED')
      expect(await hosting.saves.set('big', 'x')).toMatchObject({
        ok: false,
        reason: { code: 'QUOTA_EXCEEDED' },
      })
      expect(control.saved.has('big')).toBe(false)
      unwrap(await hosting.saves.set('big', 'x'))
      expect(control.saved.get('big')).toBe('x')
    }))

  it("holds a call until it is released, so a caller's own timeout can fire first", () =>
    withFake({}, async (hosting, control) => {
      control.hold('saves.flush')
      let answered = false
      const flushing = hosting.saves.flush().then((result) => {
        answered = true
        return result
      })
      await tick()
      expect(answered).toBe(false)
      control.release('saves.flush')
      unwrap(await flushing)
    }))

  it('answers the menu with the latest handler, and false before ready or with none', () =>
    withFake({ deferReady: true }, async (hosting, control) => {
      hosting.onMenuRequest(() => true)
      expect(control.requestMenu()).toBe(false)
      control.welcome()
      await hosting.ready
      expect(control.requestMenu()).toBe(true)
      const takeBack = hosting.onMenuRequest(() => false)
      expect(control.requestMenu()).toBe(false)
      takeBack()
      expect(control.requestMenu()).toBe(true)
    }))

  it('close runs the exiting handlers in order, then the flush, and stops at HOST_EXIT_CAP_MS', () =>
    withFake({}, async (hosting, control, clock) => {
      const order: string[] = []
      hosting.onExiting(() => void order.push('first'))
      hosting.onExiting(() => void order.push('second'))
      hosting.onExiting(() => new Promise<void>(() => undefined))
      hosting.onExiting(() => void order.push('after the stuck one'))
      const closing = control.close()
      await tick()
      clock.advance(HOST_EXIT_CAP_MS)
      await closing
      expect(order).toEqual(['first', 'second'])
    }))

  it('records fullscreen requests, rounds and leaderboard submissions', () =>
    withFake(
      { target: 'ruken' },
      async (hosting, control) => {
        unwrap(await hosting.setFullscreen(true))
        expect(hosting.display.get()).toMatchObject({ fullscreen: true })
        hosting.round.start()
        hosting.round.end('complete')
        unwrap(await hosting.leaderboards.submit('high-score', 120, { level: 3 }))
        expect(control.fullscreen).toEqual([true])
        expect(control.rounds).toEqual([{ start: true }, { end: 'complete' }])
        expect(control.submits).toEqual([{ board: 'high-score', score: 120, meta: { level: 3 } }])
      },
      { ...GAME, wants: ['leaderboards'] },
    ))
})
