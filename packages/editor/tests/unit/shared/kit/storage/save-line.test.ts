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

  it('says when the browser keeps nothing, and that a copy keeps the work; nothing is ever called Saved', () => {
    const line = saveLine({ pending: 0, where: 'nowhere' })
    expect(line).toEqual({
      state: 'failed',
      words: 'Not saved: this browser can’t keep files. Save a copy to keep your work.',
    })
    expect(saveLine({ pending: 3, where: 'nowhere' }).state).toBe('failed')
  })

  it('adds the reason a browser keeps nothing when it is known', () => {
    expect(
      saveLine({ pending: 0, where: 'nowhere', reason: 'Private storage is unavailable.' }).words,
    ).toContain('Save a copy')
  })

  it('follows the sync line once nothing waits here', () => {
    expect(saveLine({ ...device, sync: { line: 'Saved on this device and on GitHub' } })).toEqual({
      state: 'saved',
      words: 'Saved on this device and on GitHub',
    })
    expect(saveLine({ ...device, sync: { line: 'Checking GitHub…' } }).words).toBe('Checking GitHub…')
    expect(
      saveLine({ ...device, pending: 1, sync: { line: 'Saved on this device and on GitHub' } }).words,
    ).toBe('Saving…')
  })

  it('keeps a stopped or offline sync a saved state, since the device has the work', () => {
    expect(
      saveLine({ ...device, sync: { line: 'Saved on this device. Not on GitHub yet: no internet.' } }).state,
    ).toBe('saved')
  })
})
