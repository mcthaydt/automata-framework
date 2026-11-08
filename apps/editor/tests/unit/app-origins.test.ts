import { describe, expect, it } from 'vitest'
import { APP_ORIGINS, PAGE_ORIGINS } from '#src/shared/app-origins.ts'

// Apps spec section 5: the page and the game each have one literal origin per platform.

describe('the app origins', () => {
  it('are the literal strings of the spec, per platform', () => {
    expect(APP_ORIGINS).toEqual({
      macos: { page: 'tauri://localhost', game: 'automata-game://localhost' },
      ios: { page: 'tauri://localhost', game: 'automata-game://localhost' },
      linux: { page: 'tauri://localhost', game: 'automata-game://localhost' },
      windows: { page: 'http://tauri.localhost', game: 'http://automata-game.localhost' },
      android: { page: 'http://tauri.localhost', game: 'http://automata-game.localhost' },
    })
  })

  it('keep the game on a different origin from the page, so it cannot reach the app', () => {
    for (const { page, game } of Object.values(APP_ORIGINS)) expect(game).not.toBe(page)
  })

  it('name each page origin once for the sidecar to answer', () => {
    expect([...PAGE_ORIGINS].sort()).toEqual(['http://tauri.localhost', 'tauri://localhost'])
  })

  it('are not what `new URL` gives for a custom scheme, which is why they are written out', () => {
    expect(new URL(APP_ORIGINS.macos.page).origin).toBe('null')
  })
})
