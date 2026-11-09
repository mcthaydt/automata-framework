import { definePlugin } from '@automataframework/automata-sim'
import { describe, expect, it } from 'vitest'
import { defineGame, type GameSpec } from '#src/app/define-game.ts'
import { isDefinedGame } from '#src/entries/tooling.ts'

// The framework's own tooling (the website playground's frame) asks whether an example's default export came from
// defineGame, the check startGame makes, without widening the umbrella's one import.
describe('the tooling entry', () => {
  const spec: GameSpec = {
    id: 'tooling-check',
    title: 'Tooling check',
    size: { width: 320, height: 180 },
    sim: { plugins: [definePlugin({ name: 'tooling-check' })], seed: 1 },
    root: document.createElement('div'),
  }

  it('recognises a defineGame result and nothing else', () => {
    expect(isDefinedGame(defineGame(spec))).toBe(true)
    expect(isDefinedGame(spec)).toBe(false)
    expect(isDefinedGame({ ...defineGame(spec) })).toBe(false)
  })
})
