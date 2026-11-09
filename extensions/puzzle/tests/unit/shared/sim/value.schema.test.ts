// `Value` and `Cond` (M6 spec §3): puzzle owns them; narrative and systems import them, never copy them.
import { describe, expect, it } from 'vitest'
import { condSchema, valueSchema } from '#src/shared/sim/value.schema.ts'

describe('valueSchema and condSchema', () => {
  it('takes a boolean, a number or a string as a value', () => {
    for (const value of [true, 3, 'open']) expect(valueSchema.parse(value)).toBe(value)
    expect(valueSchema.safeParse(null).success).toBe(false)
  })

  it('takes every condition form, nested', () => {
    const conds = [
      { fact: 'drawer', is: 0 },
      { fact: 'drawer', atLeast: 1, atMost: 2 },
      { has: 'key' },
      { not: { any: [{ has: 'key' }, { fact: 'held', is: 'shade' }] } },
    ]
    for (const cond of conds) expect(condSchema.parse(cond)).toEqual(cond)
  })

  it('refuses a condition of no known form, or with a member it does not know', () => {
    expect(condSchema.safeParse({ fact: 'a', above: 1 }).success).toBe(false)
    expect(condSchema.safeParse({ all: [] }).success).toBe(false)
    expect(condSchema.safeParse({ any: [{ has: 1 }] }).success).toBe(false)
  })
})
