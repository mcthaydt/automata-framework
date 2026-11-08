import { describe, expect, it } from 'vitest'
import { gameId, parseIndex, rebuiltIndex, serializeIndex } from '#src/features/web-games/games-index.ts'

describe('gameId', () => {
  it('turns a name into the id the game files use', () => {
    expect(gameId('Lantern Run', [])).toBe('lantern-run')
    expect(gameId("Grandma's Game!", [])).toBe('grandma-s-game')
    expect(gameId('Crème Brûlée Café', [])).toBe('creme-brulee-cafe')
  })
  it('falls back to my-game when nothing is left, and numbers a taken one', () => {
    expect(gameId('???', [])).toBe('my-game')
    expect(gameId('Lantern Run', ['lantern-run'])).toBe('lantern-run-2')
    expect(gameId('Lantern Run', ['lantern-run', 'lantern-run-2'])).toBe('lantern-run-3')
  })
})

describe('the games index', () => {
  const games = [
    { id: 'old', title: 'Old', changed: 1 },
    { id: 'new', title: 'New', changed: 9, github: 'mcthaydt/new' },
  ]
  it('keeps the games and the one opened last through a round trip', () => {
    const text = serializeIndex({ games, last: { game: 'new', editor: 'writer' } })
    expect(parseIndex(text)).toEqual({ games, last: { game: 'new', editor: 'writer' } })
  })
  it('is undefined for text that is not an index, so the folders decide', () => {
    expect(parseIndex('not json')).toBeUndefined()
    expect(parseIndex('{"format":"other"}')).toBeUndefined()
    expect(parseIndex(JSON.stringify({ format: 'af-games/1', games: [{ id: 3 }] }))).toBeUndefined()
  })
  it('is rebuilt from the folders found, newest first by name order', () => {
    expect(rebuiltIndex(['b', 'a'], 5).games.map((game) => [game.id, game.title, game.changed])).toEqual([
      ['a', 'a', 5],
      ['b', 'b', 5],
    ])
  })
})
