import { describe, expect, it } from 'vitest'
import { ok, refuse } from '#src/shared/edit/edit.ts'

describe('ok and refuse', () => {
  it('make results with only the members they were given', () => {
    expect(ok(1)).toStrictEqual({ ok: true, level: 1 })
    expect(ok(1, ['sector:hall'])).toStrictEqual({ ok: true, level: 1, select: ['sector:hall'] })
    expect(refuse('no')).toStrictEqual({ ok: false, reason: 'no' })
    expect(refuse('no', 'sector:hall')).toStrictEqual({ ok: false, reason: 'no', at: 'sector:hall' })
  })
})
