import { describe, expect, it } from 'vitest'
import { checkVersion } from '#src/prepare/check-version.ts'

describe('checkVersion', () => {
  it('passes when there is no tag (a branch build)', () => {
    expect(checkVersion('0.1.0', undefined)).toBeUndefined()
  })

  it("passes when the tag is the game's version with a v", () => {
    expect(checkVersion('1.2.3', 'v1.2.3')).toBeUndefined()
  })

  it('names both values when they differ', () => {
    expect(checkVersion('1.2.3', 'v1.2.4')).toBe('the game is at version 1.2.3 but the tag is v1.2.4')
    expect(checkVersion('1.2.3', '1.2.3')).toBe('the game is at version 1.2.3 but the tag is 1.2.3')
  })
})
