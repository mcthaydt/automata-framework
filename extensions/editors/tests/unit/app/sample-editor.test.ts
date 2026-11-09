import { describe, expect, it } from 'vitest'
import { rememberEditor, rememberedEditor } from '#src/app/suite/sample-editor.ts'

// The try-it page opens the editor the visitor left, the way their own games do: kept in the browser's own storage, and
// harmless where the browser refuses it.

const storage = () => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  }
}
const refusing = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
  removeItem: () => {
    throw new Error('blocked')
  },
}

describe('the editor the try-it visitor left', () => {
  it('is none until one is left, then that one', () => {
    const kept = storage()
    expect(rememberedEditor(kept)).toBeUndefined()
    rememberEditor(kept, 'feel')
    expect(rememberedEditor(kept)).toBe('feel')
  })

  it('goes back to Home when the visitor goes Home', () => {
    const kept = storage()
    rememberEditor(kept, 'feel')
    rememberEditor(kept, undefined)
    expect(rememberedEditor(kept)).toBeUndefined()
  })

  it('does nothing, and says nothing, where the browser keeps nothing', () => {
    expect(rememberedEditor(refusing)).toBeUndefined()
    expect(() => rememberEditor(refusing, 'feel')).not.toThrow()
    expect(rememberedEditor(undefined)).toBeUndefined()
  })
})
