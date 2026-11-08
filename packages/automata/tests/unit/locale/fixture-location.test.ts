import { relative, resolve } from 'node:path'
import { describe, expect, inject, it } from 'vitest'

describe('the Paraglide test fixture', () => {
  it('is compiled outside src/, which the package build reads while the tests run', () => {
    const fromSrc = relative(resolve(import.meta.dirname, '../../../src'), inject('paraglideFixture'))
    expect(fromSrc.startsWith('..')).toBe(true)
  })
})
