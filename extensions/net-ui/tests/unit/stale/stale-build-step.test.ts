import { fakeClock } from '@automata/framework/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { staleBuildStep } from '#src/features/stale/stale-build-step.ts'
import { staleWords } from '#src/shared/words/stale-copy.ts'

// An online game's opening asks the server for its build facts before the title. Current, unreadable or slow: the title
// follows. Stale: the player is told the tab is out of date and offered Reload, and never reaches the title.

const own = { protocol: 1, schemaHash: '0123456789abcdef', contentHash: 'fedcba9876543210' }
const newer = { ...own, contentHash: 'ffffffffffffffff' }

afterEach(() => document.body.replaceChildren())

function start(options: Partial<Parameters<typeof staleBuildStep>[0]> = {}, locale = 'en') {
  const layer = document.createElement('div')
  document.body.append(layer)
  const clock = fakeClock()
  const abort = new AbortController()
  let settled = 0
  const reload = vi.fn()
  const done = staleBuildStep({ facts: own, fetchFacts: async () => own, reload, ...options })({
    layer,
    services: { clock, locale: { current: locale } },
    seen: { has: () => false, mark: () => {} },
    signal: abort.signal,
  } as never).then(() => void settled++)
  return { layer, clock, abort, reload, done, settled: () => settled }
}

/** Lets the step's promise chain run. */
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe('staleBuildStep', () => {
  it('current: resolves and shows nothing', async () => {
    const { layer, settled } = start()
    await flush()
    expect(settled()).toBe(1)
    expect(layer.children.length).toBe(0)
  })

  it('stale: shows the message and Reload, and does not resolve', async () => {
    const { layer, settled, clock } = start({ fetchFacts: async () => newer })
    await flush()
    expect(layer.querySelector('[role="alert"]')).toHaveTextContent(
      'This game was updated. Reload to get the new version.',
    )
    expect(layer.querySelector('button')).toHaveTextContent('Reload')
    clock.advance(60_000)
    await flush()
    expect(settled()).toBe(0)
  })

  it('Reload calls reload', async () => {
    const { layer, reload } = start({ fetchFacts: async () => newer })
    await flush()
    layer.querySelector('button')?.click()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('no answer within 1500 ms: resolves, and a late "stale" is dropped', async () => {
    let answer: (facts: unknown) => void = () => {}
    const { layer, clock, settled } = start({
      fetchFacts: () => new Promise((resolve) => (answer = resolve)),
    })
    clock.advance(1499)
    await flush()
    expect(settled()).toBe(0)
    clock.advance(1)
    await flush()
    expect(settled()).toBe(1)
    answer(newer)
    await flush()
    expect(layer.children.length).toBe(0)
  })

  it('waits as long as the game says, on the runtime’s clock', async () => {
    const { clock, settled } = start({ waitMs: 200, fetchFacts: () => new Promise(() => {}) })
    clock.advance(199)
    await flush()
    expect(settled()).toBe(0)
    clock.advance(1)
    await flush()
    expect(settled()).toBe(1)
  })

  it('unreadable (a throw, a bad shape): resolves', async () => {
    const thrown = start({
      fetchFacts: async () => {
        throw new Error('offline')
      },
    })
    const odd = start({ fetchFacts: async () => ({ protocol: 'x' }) })
    await flush()
    expect(thrown.settled()).toBe(1)
    expect(odd.settled()).toBe(1)
  })

  it('an aborted signal resolves a stale panel and removes it', async () => {
    const { layer, abort, settled } = start({ fetchFacts: async () => newer })
    await flush()
    abort.abort()
    await flush()
    expect(settled()).toBe(1)
    expect(layer.querySelector('[role="alert"]')).toBeNull()
  })

  it.each(['ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans'])('says it in %s by default', async (locale) => {
    const { layer } = start({ fetchFacts: async () => newer }, locale)
    await flush()
    expect(layer).toHaveTextContent(staleWords(locale).message)
    expect(layer.querySelector('button')).toHaveTextContent(staleWords(locale).reload)
    expect(staleWords(locale).message).not.toBe(staleWords('en').message)
  })

  it('takes the game’s own words, fixed or by locale', async () => {
    const fixed = start({ fetchFacts: async () => newer, copy: { message: 'Old tab', reload: 'Go' } })
    const byLocale = start(
      { fetchFacts: async () => newer, copy: (locale) => ({ message: `Old in ${locale}`, reload: 'Go' }) },
      'ko',
    )
    await flush()
    expect(fixed.layer).toHaveTextContent('Old tab')
    expect(byLocale.layer).toHaveTextContent('Old in ko')
  })
})

describe('staleWords', () => {
  it('speaks English for a language it does not have, and matches on the primary language', () => {
    expect(staleWords('fr').reload).toBe('Reload')
    expect(staleWords('pt').message).toBe(staleWords('pt-BR').message)
  })
})
