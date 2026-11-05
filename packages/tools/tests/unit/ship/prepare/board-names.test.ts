import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { declaredBoardsIn, findUndeclaredBoards } from '#src/features/ship/prepare/board-names.ts'

// The board check (M5 spec §4.8, L-b): a board a game names must be a key of its ship config's `leaderboards`, or
// Ruken has no such board to take the score. Read from the game's sources, so the failure names the call site.

function game(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'board-names-'))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  return dir
}

const scores = (board: string) => `import { defineGame } from '@mcthaydt/automata-game'
export default defineGame({
  id: 'g',
  scores: {
    finished: { board: '${board}', score: (payload) => 1 },
  },
})
`

describe('findUndeclaredBoards', () => {
  it('passes a game whose boards are all declared', () => {
    const dir = game({
      'src/game.ts': scores('best'),
      'src/board.ts':
        "export const show = (boards) => [boards.submitScore('best', 3), boards.readBoard('fastest')]\n",
    })
    expect(findUndeclaredBoards(dir, ['best', 'fastest'])).toEqual([])
  })

  it('names an undeclared board in scores, with its file, line and column', () => {
    const dir = game({ 'src/game.ts': scores('bset') })
    expect(findUndeclaredBoards(dir, ['best'])).toEqual([
      { board: 'bset', file: 'src/game.ts', line: 5, col: 24 },
    ])
  })

  it('names an undeclared board passed to submitScore or readBoard, as a method or a plain call', () => {
    const dir = game({
      'main.ts': "submitScore('weekly', 10)\n",
      'src/screens/results.ts': "\nexport const read = (lb) => lb.readBoard('all-time')\n",
    })
    expect(findUndeclaredBoards(dir, ['best'])).toEqual([
      { board: 'weekly', file: 'main.ts', line: 1, col: 13 },
      { board: 'all-time', file: 'src/screens/results.ts', line: 2, col: 42 },
    ])
  })

  it('skips a board passed as a value (its type checks it), and never reads node_modules or the build', () => {
    const dir = game({
      'src/game.ts': "const board = 'weekly'\nexport const go = (lb) => lb.submitScore(board, 1)\n",
      'node_modules/x/index.ts': scores('elsewhere'),
      'dist/assets/index.js': scores('built'),
    })
    expect(findUndeclaredBoards(dir, [])).toEqual([])
  })
})

describe('declaredBoardsIn', () => {
  it("reads the keys of a ship.config.ts's leaderboards object, as written", () => {
    const config = `export default defineShipConfig({
  game: { id: 'g' },
  leaderboards: { best: { order: 'desc', min: 0, max: 9 }, 'all-time': { order: 'asc', min: 1, max: 9 } },
})`
    expect(declaredBoardsIn(config)).toEqual(['best', 'all-time'])
    expect(declaredBoardsIn("export default defineShipConfig({ game: { id: 'g' } })")).toEqual([])
  })

  it('cannot read boards written as a value or spread in, nor a file that does not parse', () => {
    expect(declaredBoardsIn('export default defineShipConfig({ leaderboards: BOARDS })')).toBeUndefined()
    expect(
      declaredBoardsIn('export default defineShipConfig({ leaderboards: { ...BOARDS } })'),
    ).toBeUndefined()
    expect(declaredBoardsIn('export default defineShipConfig({')).toBeUndefined()
  })
})
