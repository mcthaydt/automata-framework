import { describe, expect, it } from 'vitest'
import { saveLine } from '#src/shared/kit/storage/save-line.ts'

// The words at the top of the editors: every row of the spec's table, in words a drunk grandma follows.

const folder = { pending: 0, where: 'folder' } as const
const device = { pending: 0, where: 'device' } as const

describe('saveLine', () => {
  it('says Saving… while a field waits or a write runs', () => {
    expect(saveLine({ ...folder, pending: 1 })).toEqual({ state: 'saving', words: 'Saving…' })
    expect(saveLine({ ...device, pending: 2 })).toEqual({ state: 'saving', words: 'Saving…' })
  })

  it('says where the game is kept once nothing waits', () => {
    expect(saveLine(folder)).toEqual({ state: 'saved', words: 'Saved in your game folder' })
    expect(saveLine(device)).toEqual({ state: 'saved', words: 'Saved on this device' })
  })

  it('says a write failed, with the store’s own words, ahead of Saving…', () => {
    expect(saveLine({ ...device, pending: 1, failed: 'The disk is full.' })).toEqual({
      state: 'failed',
      words: 'Not saved: The disk is full.',
    })
  })

  it('says when the browser keeps nothing, and that the work goes with the page; nothing is ever called Saved', () => {
    const line = saveLine({ pending: 0, where: 'nowhere' })
    expect(line).toEqual({
      state: 'failed',
      words: 'Not saved: this browser can’t keep your work. It is lost when this page closes.',
    })
    expect(saveLine({ pending: 3, where: 'nowhere' }).state).toBe('failed')
  })
})
