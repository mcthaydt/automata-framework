import { fakeClock } from '@automataframework/framework/testing'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { commands } from 'vitest/browser'
import { staleBuildStep } from '#src/features/stale/stale-build-step.ts'

// The stale-build check end to end, the way a deployed game meets it: the page and the server are different origins
// (`@automataframework/net-server` serves no game files), the server is the real one's probe routes in Node, and the page asks
// with a plain `fetch`, as `extensions/net/README.md` tells a game to. A stand-in fetch cannot see what a browser does
// with a cross-origin answer, which is how a check that never said "stale" shipped; this can.

/** The commands `vitest.config.ts` defines: the real server's probe routes, on another origin than this page. */
const { versionServerStart, versionServerStop } = commands as unknown as {
  versionServerStart(allowedOrigin: string, facts: typeof own): Promise<{ id: number; url: string }>
  versionServerStop(id: number): Promise<void>
}

const own = { protocol: 1, schemaHash: '0123456789abcdef', contentHash: 'fedcba9876543210' }

let serverId: number | undefined
let layer: HTMLElement

beforeEach(() => {
  layer = document.createElement('div')
  document.body.append(layer)
})

afterEach(async () => {
  layer.remove()
  if (serverId !== undefined) await versionServerStop(serverId)
  serverId = undefined
})

/** Starts the server for `facts`, allowing `allowed` as the page's origin; runs the game's step against it. */
async function run(facts: typeof own, allowed: string) {
  const started = await versionServerStart(allowed, facts)
  serverId = started.id
  expect(started.url).not.toContain(location.host) // another origin, not the page's own
  let settled = false
  const done = staleBuildStep({
    facts: own,
    fetchFacts: () => fetch(`${started.url}/version`).then((response) => response.json()),
    reload: () => {},
  })({
    layer,
    services: { clock: fakeClock(), locale: { current: 'en' } },
    seen: { has: () => false, mark: () => {} },
    signal: new AbortController().signal,
  } as never).then(() => {
    settled = true
  })
  return { done, settled: () => settled }
}

describe('the stale-build check across origins', () => {
  test('the same build: the title follows and nothing is shown', async () => {
    const { done } = await run(own, location.origin)
    await done
    expect(layer.children.length).toBe(0)
  })

  test('a newer build: the panel says the game was updated and offers Reload, and the title is not reached', async () => {
    const { settled } = await run({ ...own, contentHash: 'ffffffffffffffff' }, location.origin)
    await vi.waitFor(() => expect(layer.querySelector('[role="alert"]')).toBeTruthy())
    expect(layer.textContent).toMatch(/This game was updated/)
    expect(layer.querySelector('button')?.textContent).toBe('Reload')
    expect(settled()).toBe(false)
  })

  test('a server that does not list the page: the browser refuses the answer, and the check says it could not run', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { done } = await run(own, 'https://some-other-game.example.invalid')
    await done
    expect(layer.children.length).toBe(0)
    expect(warn.mock.calls.map((call) => String(call[0])).join('\n')).toMatch(/could not check/i)
    warn.mockRestore()
  })
})
