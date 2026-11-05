import { describe, expect, it } from 'vitest'
import { reducedMotion } from '#src/shared/ui/browser/reduced-motion.ts'

const withMedia = (reduce: boolean) =>
  ({
    matchMedia: (query: string) => ({ matches: reduce && query === '(prefers-reduced-motion: reduce)' }),
  }) as unknown as Window

describe('reducedMotion', () => {
  it('follows prefers-reduced-motion: reduce', () => {
    expect(reducedMotion(withMedia(true))).toBe(true)
    expect(reducedMotion(withMedia(false))).toBe(false)
  })

  it('is false where the window cannot answer', () => {
    expect(reducedMotion({} as Window)).toBe(false)
  })
})
