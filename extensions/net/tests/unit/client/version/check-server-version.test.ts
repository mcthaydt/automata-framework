import { describe, expect, it } from 'vitest'
import {
  type BuildFacts,
  buildFactsSchema,
  checkServerVersion,
} from '#src/features/client/version/check-server-version.ts'

// A tab asks the server for its build facts before an online game's title and compares them with its own. Only a
// readable answer that differs says "stale". Anything else (offline, a refused cross-origin read, a 503, a shape it does
// not know) is "unchecked", never "current": the tab then goes on, because the join check is the authority and a flaky
// probe must never lock a player out, but a check that could not run is not a check that passed.

const own: BuildFacts = { protocol: 1, schemaHash: '0123456789abcdef', contentHash: 'fedcba9876543210' }

describe('checkServerVersion', () => {
  it('is current when the server says the same', async () => {
    expect(await checkServerVersion(async () => own, own)).toBe('current')
  })

  it.each([
    ['protocol', { ...own, protocol: 2 }],
    ['schema', { ...own, schemaHash: 'ffffffffffffffff' }],
    ['content', { ...own, contentHash: 'ffffffffffffffff' }],
  ])('is stale when the %s differs', async (_what, facts) => {
    expect(await checkServerVersion(async () => facts, own)).toBe('stale')
  })

  it('is unchecked, not current, when the answer cannot be had: a throw, a rejection, a bad shape, nothing', async () => {
    expect(
      await checkServerVersion(async () => {
        throw new Error('offline')
      }, own),
    ).toBe('unchecked')
    // What a browser does with a cross-origin answer it may not hand to the page.
    expect(await checkServerVersion(() => Promise.reject(new TypeError('Failed to fetch')), own)).toBe(
      'unchecked',
    )
    expect(await checkServerVersion(async () => ({ protocol: 'x' }), own)).toBe('unchecked')
    expect(await checkServerVersion(async () => ({}), own)).toBe('unchecked')
    expect(await checkServerVersion(async () => null, own)).toBe('unchecked')
    expect(await checkServerVersion(async () => 'nope', own)).toBe('unchecked')
  })

  it('is unchecked when the fetch throws synchronously', async () => {
    expect(
      await checkServerVersion(() => {
        throw new Error('no network')
      }, own),
    ).toBe('unchecked')
  })
})

describe('buildFactsSchema', () => {
  it('takes the three facts the join already carries, and refuses extras and a wrong type', () => {
    expect(buildFactsSchema.safeParse(own).success).toBe(true)
    expect(buildFactsSchema.safeParse({ ...own, protocol: '1' }).success).toBe(false)
    expect(buildFactsSchema.safeParse({ ...own, extra: 1 }).success).toBe(false)
  })
})
