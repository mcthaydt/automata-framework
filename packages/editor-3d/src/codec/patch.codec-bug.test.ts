// A structure edit that fails its own re-parse check means the codec has a bug, not that the user asked for
// something wrong; the patch holds the save (verify-failed) instead of throwing into the editor.
import { describe, expect, it, vi } from 'vitest'
import { JsonShapeError } from './structure'

vi.mock('./structure', async (importOriginal) => {
  const original = await importOriginal<typeof import('./structure')>()
  return {
    ...original,
    insertElement: () => {
      throw new original.JsonShapeError('the insert would leave the file invalid', ['a', 1])
    },
  }
})

describe('a structure edit that refuses its own result', () => {
  it('becomes a verify-failed refusal at that path, with no text', async () => {
    const { patchJson } = await import('./patch')
    const result = patchJson(
      '{ "a": [1] }',
      { a: [1] },
      { a: [1, 2] },
      { idArrays: [], memberOrder: () => undefined },
    )
    expect(result).toMatchObject({ ok: false, path: ['a', 1], reason: 'verify-failed' })
    expect(!result.ok && result.detail).toContain('the insert would leave the file invalid')
    expect(result).not.toHaveProperty('text')
    expect(new JsonShapeError('x')).toBeInstanceOf(Error)
  })
})
