import { describe, expect, it } from 'vitest'
import {
  type BuildFacts,
  buildFactsSchema,
  checkServerVersion,
} from '#src/features/client/version/check-server-version.ts'

// A tab asks the server for its build facts before an online game's title and compares them with its own. Only a
// readable answer that differs says "stale": anything else (offline, a 503, a shape it does not know) passes, because
// the join check is the authority and a flaky probe must never lock a player out.

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

  it('is current when the answer cannot be had: a throw, a rejection, a bad shape, nothing', async () => {
    expect(
      await checkServerVersion(async () => {
        throw new Error('offline')
      }, own),
    ).toBe('current')
    expect(await checkServerVersion(() => Promise.reject(new Error('503')), own)).toBe('current')
    expect(await checkServerVersion(async () => ({ protocol: 'x' }), own)).toBe('current')
    expect(await checkServerVersion(async () => ({}), own)).toBe('current')
    expect(await checkServerVersion(async () => null, own)).toBe('current')
    expect(await checkServerVersion(async () => 'nope', own)).toBe('current')
  })

  it('is current when the fetch throws synchronously', async () => {
    expect(
      await checkServerVersion(() => {
        throw new Error('no network')
      }, own),
    ).toBe('current')
  })
})

describe('buildFactsSchema', () => {
  it('takes the three facts the join already carries, and refuses extras and a wrong type', () => {
    expect(buildFactsSchema.safeParse(own).success).toBe(true)
    expect(buildFactsSchema.safeParse({ ...own, protocol: '1' }).success).toBe(false)
    expect(buildFactsSchema.safeParse({ ...own, extra: 1 }).success).toBe(false)
  })
})
