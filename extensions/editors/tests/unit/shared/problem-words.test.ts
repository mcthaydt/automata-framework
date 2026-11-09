import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { problemWords } from '#src/shared/problem-words.ts'

const firstIssue = (schema: z.ZodType, value: unknown) => {
  const result = schema.safeParse(value)
  if (result.success) throw new Error('expected a failure')
  const issue = result.error.issues[0]
  if (issue === undefined) throw new Error('expected an issue')
  return issue
}

describe('problemWords', () => {
  it('says a bound as a person would', () => {
    expect(problemWords(firstIssue(z.number().max(1), 3))).toBe('Must be 1 or less.')
    expect(problemWords(firstIssue(z.number().min(0), -1))).toBe('Must be 0 or more.')
    expect(problemWords(firstIssue(z.number().positive(), 0))).toBe('Must be more than 0.')
    expect(problemWords(firstIssue(z.number().int(), 1.5))).toBe('Must be a whole number.')
    expect(problemWords(firstIssue(z.string().min(1), ''))).toBe('Must not be empty.')
  })

  it('says a wrong kind of value in words', () => {
    expect(problemWords(firstIssue(z.number(), 'a'))).toBe('Must be a number.')
    expect(problemWords(firstIssue(z.string(), 1))).toBe('Must be text.')
    expect(problemWords(firstIssue(z.array(z.string()), 1))).toBe('Must be a list.')
    expect(problemWords(firstIssue(z.boolean(), 1))).toBe('Must be on or off.')
  })

  it('names a value that is not one of the choices', () => {
    expect(problemWords(firstIssue(z.enum(['music', 'sfx']), 'loud'))).toBe('Must be one of: music, sfx.')
  })

  it('names a key the file does not use', () => {
    expect(problemWords(firstIssue(z.strictObject({ a: z.number() }), { a: 1, b: 2 }))).toBe(
      'This file does not use “b”.',
    )
  })

  it('keeps the words of a check written for people', () => {
    expect(
      problemWords(
        firstIssue(
          z
            .number()
            .superRefine((_, ctx) => ctx.addIssue({ code: 'custom', message: 'two entries answer a' })),
          1,
        ),
      ),
    ).toBe('Two entries answer a.')
  })
})
