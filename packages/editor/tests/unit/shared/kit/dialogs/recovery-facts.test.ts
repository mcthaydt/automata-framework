import { describe, expect, it } from 'vitest'
import { recoveryWords } from '#src/shared/kit/dialogs/recovery-facts.ts'

// What the restore dialog says about the changes kept from last time, in plain words (the grandma audit, section
// 5.2): the level's name and when it was changed, never a file name, "autosave" or "on disk".

describe('recoveryWords', () => {
  const now = 1_700_000_000_000
  it('names the level and when it was changed', () => {
    expect(
      recoveryWords('Mossgate', { payload: '', savedAt: now - 5 * 60_000, baseChanged: false }, now),
    ).toEqual({
      kept: 'You changed Mossgate 5 min ago and didn’t save. Your changes were kept.',
      warning: undefined,
    })
  })
  it('says “on” before a date', () => {
    const words = recoveryWords(
      'Mossgate',
      { payload: '', savedAt: now - 5 * 86_400_000, baseChanged: false },
      now,
      'UTC',
    )
    expect(words.kept).toBe('You changed Mossgate on Nov 9 and didn’t save. Your changes were kept.')
  })
  it('warns when it changed somewhere else too, since keeping replaces that change', () => {
    const words = recoveryWords('Mossgate', { payload: '', savedAt: now, baseChanged: true }, now)
    expect(words.warning).toBe(
      'Mossgate was also changed somewhere else since then. Keeping your changes replaces that.',
    )
  })
})
