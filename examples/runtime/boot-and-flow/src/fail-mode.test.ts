import { describe, expect, it } from 'vitest'
import { FAIL_MODES, type FailMode, failMode } from './fail-mode.ts'

describe('failMode (§8 ?fail= query)', () => {
  it.each([
    ['?fail=init', 'init'],
    ['?fail=saves', 'saves'],
    ['?fail=content', 'content'],
    ['?fail=download', 'download'],
    ['?fail=stall', 'stall'],
    ['?fail=renderer', 'renderer'],
    ['?fail=ready', 'ready'],
  ] as const)("failMode('%s') is '%s'", (query, expected: FailMode) => {
    expect(failMode(query)).toBe(expected)
  })

  it('full URL query is parsed correctly', () => {
    expect(failMode('http://localhost:5400/?fail=stall&other=1')).toBe('stall')
  })

  it('unknown or missing fail param returns undefined', () => {
    expect(failMode('?fail=unknown')).toBeUndefined()
    expect(failMode('?other=value')).toBeUndefined()
    expect(failMode('')).toBeUndefined()
  })

  it('FAIL_MODES contains all seven fail modes', () => {
    expect(FAIL_MODES).toEqual(['init', 'saves', 'content', 'download', 'stall', 'renderer', 'ready'])
  })
})
