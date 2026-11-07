// The `Hosting` contract cases every adapter passes.
// `ruken/hosting-ruken.contract.test.ts` runs them against the Ruken adapter (over the fake Ruken host) and
// `web/hosting-web.test.ts` against the web adapter (over a fake page). A case that only one adapter can pass is
// not here: it lives beside that adapter, and every intended difference has its own test named after it. Published
// in `@automata/framework/testing` so `FakeHosting` runs the same cases; it needs Vitest.
import { describe, expect, it } from 'vitest'
import type { HostResult } from '../../shared/host/errors'
import type { Hosting } from '../../shared/host/hosting'
import { unwrap } from '../unwrap'

/** An adapter under test: a fresh `Hosting` per case, with `saves` granted. */
export type HostingFactory = () => Hosting | Promise<Hosting>

/** Lets the fake Ruken host answer over its in-memory ports (for example one macrotask). */
export type Settle = () => Promise<void>

const observedOf = (hosting: Hosting) => ({
  lifecycle: hosting.lifecycle,
  input: hosting.input,
  display: hosting.display,
  audio: hosting.audio,
  entitlements: hosting.entitlements,
  savesStatus: hosting.savesStatus,
})

/**
 * Registers the `Hosting` contract's cases as a Vitest `describe` block named after `name`. `create` builds a fresh
 * `Hosting` for each case, with `saves` granted; `settled` lets the host answer (for example one macrotask). Every
 * target's adapter and `FakeHosting` pass these cases. Each case disposes its `Hosting`.
 */
export function describeHostingContract(name: string, create: HostingFactory, settled: Settle): void {
  /** Runs `program` on a fresh `Hosting`, disposing it afterwards. */
  const withHosting = async (program: (hosting: Hosting) => Promise<void> | void): Promise<void> => {
    const hosting = await create()
    try {
      await program(hosting)
    } finally {
      hosting.dispose()
    }
  }

  describe(`the Hosting contract: ${name}`, () => {
    it('is ready, with no handshake fallback reported', () =>
      withHosting(async (hosting) => {
        unwrap(await hosting.ready)
        expect(hosting.handshake.fellBack).toBeNull()
      }))

    it('names its kind and its host for the UI', () =>
      withHosting((hosting) => {
        expect(['ruken', 'standalone', 'web', 'tauri']).toContain(hosting.kind)
        expect(hosting.hostName).toMatch(/\S/)
      }))

    it('reads a player and a locale', () =>
      withHosting((hosting) => {
        expect(typeof hosting.player.id).toBe('string')
        expect(typeof hosting.player.displayName).toBe('string')
        expect(hosting.locale).toMatch(/^[a-z]{2}/)
      }))

    it('grants saves when the game may keep them', () =>
      withHosting((hosting) => {
        expect(hosting.granted.has('saves')).toBe(true)
      }))

    it('keeps a save: set, get, remove, and a missing key reads null', () =>
      withHosting(async (hosting) => {
        expect(unwrap(await hosting.saves.get('progress'))).toBeNull()
        unwrap(await hosting.saves.set('progress', '2'))
        expect(unwrap(await hosting.saves.get('progress'))).toBe('2')
        unwrap(await hosting.saves.remove('progress'))
        expect(unwrap(await hosting.saves.get('progress'))).toBeNull()
      }))

    it('flushes saves and says where they went', () =>
      withHosting(async (hosting) => {
        unwrap(await hosting.saves.set('progress', '2'))
        const flushing = hosting.saves.flush()
        await settled()
        expect(unwrap(await flushing)).toMatchObject({
          persisted: expect.stringMatching(/^(host-outbox|server|device)$/),
        })
      }))

    it('lists the keys it holds, sorted by code unit, and drops a removed one (M5 spec §4.1)', () =>
      withHosting(async (hosting) => {
        expect(unwrap(await hosting.saves.keys())).toEqual([])
        for (const key of ['b', 'B', 'a.slot.0', 'a']) unwrap(await hosting.saves.set(key, '1'))
        expect(unwrap(await hosting.saves.keys())).toEqual(['B', 'a', 'a.slot.0', 'b'])
        unwrap(await hosting.saves.remove('a'))
        expect(unwrap(await hosting.saves.keys())).toEqual(['B', 'a.slot.0', 'b'])
      }))

    it('reports saves as saved when nothing is pending', () =>
      withHosting((hosting) => {
        expect(hosting.savesStatus.get()).toBe('saved')
      }))

    it('starts every observed value with the current one', () =>
      withHosting((hosting) => {
        for (const [what, observed] of Object.entries(observedOf(hosting))) {
          const heard: unknown[] = []
          const stop = (observed as typeof hosting.lifecycle).subscribe((value) => heard.push(value))
          stop()
          expect(heard, what).toEqual([observed.get()])
        }
      }))

    it('never refuses a round or an analytics event', () =>
      withHosting((hosting) => {
        hosting.round.start()
        hosting.round.start()
        hosting.round.end('complete')
        hosting.round.end()
        hosting.track('anything', { level: 1 })
      }))

    it('gives one round-end event per round that ended, with its outcome, and none for a dropped end (M5.2)', () =>
      withHosting(async (hosting) => {
        const heard: (string | undefined)[] = []
        hosting.round.ended.subscribe((outcome) => heard.push(outcome))
        await settled()
        hosting.round.end('quit') // no round open: dropped
        hosting.round.start()
        hosting.round.start() // a second start: dropped
        hosting.round.end('complete')
        hosting.round.end('quit') // already ended: dropped
        hosting.round.start()
        hosting.round.end()
        expect(heard).toEqual(['complete', undefined])
      }))

    it('refuses leaderboard calls UNSUPPORTED when the host has no leaderboards, and keeps no local board (PRODUCT.1)', () =>
      withHosting(async (hosting) => {
        unwrap(await hosting.ready)
        expect(await hosting.leaderboards.submit('high-score', 1)).toMatchObject({
          ok: false,
          reason: { code: 'UNSUPPORTED', operation: 'leaderboard.submit' },
        })
        expect(await hosting.leaderboards.get('high-score')).toMatchObject({
          ok: false,
          reason: { code: 'UNSUPPORTED', operation: 'leaderboard.get' },
        })
      }))

    it('takes menu and exiting handlers, and gives each back', () =>
      withHosting((hosting) => {
        const takeMenuBack = hosting.onMenuRequest(() => true)
        const takeExitBack = hosting.onExiting(() => undefined)
        takeMenuBack()
        takeExitBack()
      }))

    it('stops the saves-changed and round-ended listeners when Hosting is disposed, and may be disposed twice', async () => {
      const hosting = await create()
      const heard: unknown[] = []
      hosting.saves.changed.subscribe((change) => heard.push(change))
      hosting.round.ended.subscribe((outcome) => heard.push(outcome))
      await settled()
      hosting.dispose()
      hosting.dispose()
      hosting.round.start()
      hosting.round.end('complete')
      expect(heard).toEqual([])
    })

    it('refuses saves and requests on a disposed Hosting with CANCELLED instead of dropping them', async () => {
      const hosting = await create()
      hosting.dispose()
      const attempts: Promise<HostResult<unknown>>[] = [
        hosting.saves.set('progress', '2'),
        hosting.saves.get('progress'),
        hosting.saves.remove('progress'),
        hosting.saves.flush(),
        hosting.saves.keys(),
        hosting.leaderboards.submit('high-score', 1),
        hosting.leaderboards.get('high-score'),
        hosting.setFullscreen(true),
        hosting.exit(),
      ]
      for (const attempt of attempts) {
        expect(await attempt).toMatchObject({ ok: false, reason: { code: 'CANCELLED' } })
      }
    })
  })
}
