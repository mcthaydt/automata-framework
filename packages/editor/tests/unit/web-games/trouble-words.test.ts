import { describe, expect, it } from 'vitest'
import { troubleWords } from '#src/features/web-games/trouble-words.ts'
import { OfflineError } from '#src/shared/kit/sync/git-engine.ts'

describe('troubleWords', () => {
  it.each([
    'Failed to fetch',
    'Load failed',
    'NetworkError when attempting to fetch resource.',
    'fetch failed',
  ])('puts the browser’s “%s” into words a person can act on', (message) => {
    expect(troubleWords(new TypeError(message), 'press Get it again')).toBe(
      'Can’t reach GitHub. Check your internet and press Get it again.',
    )
  })

  it('says the same for the sync’s own no-internet error', () => {
    expect(troubleWords(new OfflineError(), 'press Check again')).toBe(
      'Can’t reach GitHub. Check your internet and press Check again.',
    )
  })

  it('keeps words that were already written for a person', () => {
    expect(troubleWords(new Error('Sign in to GitHub again to get this game.'), 'press Get it again')).toBe(
      'Sign in to GitHub again to get this game.',
    )
  })

  it('says something kind for a thing that is not an error at all', () => {
    expect(troubleWords('boom', 'press Get it again')).toBe('boom')
  })
})
