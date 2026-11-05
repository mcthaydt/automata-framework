import { describe, expect, it } from 'vitest'
import { BUILD_ID_PATTERN, buildIdFor } from '#src/features/ship/deploy/build-id.ts'

describe('buildIdFor', () => {
  it("is the commit's UTC time to the minute, then its short sha (FloorFifty build-tag)", () => {
    const id = buildIdFor({
      time: new Date('2026-10-11T07:05:59-05:00'),
      sha: 'abcdef0123456789abcdef0123456789abcdef01',
    })
    expect(id).toBe('202610111205-abcdef0')
    expect(BUILD_ID_PATTERN.test(id)).toBe(true)
  })

  it('sorts as the commits do', () => {
    const older = buildIdFor({ time: new Date('2026-10-11T23:59:00Z'), sha: 'fffffff' })
    const newer = buildIdFor({ time: new Date('2026-10-12T00:00:00Z'), sha: '0000000' })
    expect([newer, older].sort()).toEqual([older, newer])
  })

  it('refuses a sha that is not hex or shorter than seven characters', () => {
    expect(() => buildIdFor({ time: new Date(0), sha: 'abc' })).toThrow(/sha/)
    expect(() => buildIdFor({ time: new Date(0), sha: 'ABCDEFG' })).toThrow(/sha/)
  })
})
