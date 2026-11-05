import { describe, expect, it } from 'vitest'
import { ok, refused } from '#src/shared/lib/result.ts'

describe('Result', () => {
  it('ok carries the value', () => {
    expect(ok(3)).toEqual({ ok: true, value: 3 })
  })

  it('refused carries the reason and no value', () => {
    expect(refused('denied')).toEqual({ ok: false, reason: 'denied' })
  })

  it('narrows on the ok flag', () => {
    const result = Math.random() >= 0 ? ok('x') : refused(1)
    if (result.ok) expect(result.value).toBe('x')
    else expect(result.reason).toBe(1)
  })
})
