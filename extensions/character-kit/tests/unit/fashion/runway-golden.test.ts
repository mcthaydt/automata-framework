// The runway golden's expected md5 for a cell on this machine: one shared md5 per cell, and the few cells another arch is known
// to paint differently carry an override for that arch. Everything else must match on every arch, so a new arch difference
// still fails (and prints its diff, tests/fixtures/cell-miss.ts).
import { describe, expect, it } from 'vitest'
import { ARCH_OVERRIDES, expectedFitMd5, RUNWAY_GOLDEN } from '../../fixtures/runway-golden.ts'

const SHARED_NIA_THIN_0 = RUNWAY_GOLDEN.fit.nia?.thin?.['0']
const ARM64_NIA_THIN_0 = '259c7a376180713d893c1fdf5ac99b3e'

describe('the runway golden per arch', () => {
  it('has the shared md5 for nia on thin, direction 0 that Linux x64 paints', () => {
    expect(SHARED_NIA_THIN_0).toBe('713010728966bde766492fee6637f4d4')
  })

  it('gives arm64 its own md5 for that one cell', () => {
    expect(expectedFitMd5('nia', 'thin', 0, 'arm64')).toBe(ARM64_NIA_THIN_0)
  })

  it('gives every other arch the shared md5 for it', () => {
    for (const arch of ['x64', 'ia32', 'riscv64'])
      expect(expectedFitMd5('nia', 'thin', 0, arch)).toBe(SHARED_NIA_THIN_0)
  })

  it('gives arm64 the shared md5 for every other cell', () => {
    for (const [id, bodies] of Object.entries(RUNWAY_GOLDEN.fit)) {
      for (const [body, directions] of Object.entries(bodies)) {
        for (const [direction, md5] of Object.entries(directions)) {
          if (`${id}/${body}/${direction}` === 'nia/thin/0') continue
          expect(expectedFitMd5(id, body, Number(direction), 'arm64'), `${id}/${body}/${direction}`).toBe(md5)
        }
      }
    }
  })

  it('has no override that names a cell the golden does not hold, or that equals the shared md5', () => {
    for (const [key, byArch] of Object.entries(ARCH_OVERRIDES)) {
      const [id = '', body = '', direction = ''] = key.split('/')
      const shared = RUNWAY_GOLDEN.fit[id]?.[body]?.[direction]
      expect(shared, `${key} is a cell of the golden`).toBeDefined()
      for (const [arch, md5] of Object.entries(byArch)) {
        expect(md5, `${key} on ${arch}`).toMatch(/^[0-9a-f]{32}$/)
        expect(md5, `${key} on ${arch} differs from the shared md5`).not.toBe(shared)
      }
    }
  })

  it('defaults to the arch this runs on', () => {
    expect(expectedFitMd5('nia', 'thin', 0)).toBe(expectedFitMd5('nia', 'thin', 0, process.arch))
  })
})
