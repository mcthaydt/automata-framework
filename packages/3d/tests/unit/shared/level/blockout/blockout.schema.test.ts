import { describe, expect, it } from 'vitest'
import { blockoutSchema } from '#src/shared/level/blockout/blockout.schema.ts'
import { TOY } from '#src/shared/level/blockout/toy-blockout.ts'

// The blockout schema on a small file (the shipped files parse in the editor's fixture tests).

const refusedAt = (value: unknown): PropertyKey[][] | undefined => {
  const result = blockoutSchema.safeParse(value)
  return result.success ? undefined : result.error.issues.map((issue) => issue.path)
}

describe('the blockout schema', () => {
  it('parses a file, and the parse is the file’s own value (a validator, not a transform)', () => {
    const result = blockoutSchema.safeParse(TOY)
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true)
    expect(result.data).toStrictEqual(TOY)
  })

  it('refuses a file with no spawn, at the spawn', () => {
    const { spawn: _spawn, ...without } = TOY
    expect(refusedAt(without)).toContainEqual(['spawn'])
  })

  it('refuses rooms that are not a list, at the rooms', () => {
    expect(refusedAt({ ...TOY, rooms: 'x' })).toContainEqual(['rooms'])
  })

  it('keeps a member it does not know, in a room and in the file', () => {
    const json = { ...TOY, extra: { kept: true }, rooms: [{ ...TOY.rooms[0], note: 'x' }, TOY.rooms[1]] }
    const result = blockoutSchema.safeParse(json)
    expect(result.success).toBe(true)
    expect(result.data).toStrictEqual(json)
  })
})
