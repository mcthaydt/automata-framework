// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cellCentre, parseCamera } from '../../e2e/harness/canvas-pointer.ts'
import { printedAddress } from '../../e2e/harness/run-editor.ts'
import { copyGame } from '../../e2e/harness/temp-game.ts'

// The logic in the journeys' harness (tests/e2e/harness/): where a cell is on the page, the address the command
// prints, and what a game's temp copy holds.
describe('the cell under a tap', () => {
  it('reads the canvas camera, and refuses one it cannot use', () => {
    expect(parseCamera('4,8,2')).toEqual({ x: 4, y: 8, scale: 2 })
    expect(() => parseCamera(null)).toThrow('no camera yet')
    expect(() => parseCamera('4,8,0')).toThrow('no camera yet')
  })

  it("is the cell's centre, through the camera, from the canvas's corner on the page", () => {
    // A 16 px grid drawn at 2x from (10, 20) in a canvas whose box starts at (100, 50): cell (1, 2) spans 16 to 32
    // and 32 to 48 level pixels, so its centre (24, 40) is drawn at 10 + 48 and 20 + 80, plus the box's corner.
    expect(cellCentre({ col: 1, row: 2 }, 16, { x: 10, y: 20, scale: 2 }, { x: 100, y: 50 })).toEqual({
      x: 158,
      y: 150,
    })
  })
})

describe("the editor's address", () => {
  it('is the "This computer" line, once it is printed', () => {
    expect(printedAddress('Editing /g with the 2d editor.\n')).toBeUndefined()
    expect(printedAddress('Editing /g.\n  This computer: http://127.0.0.1:5123/?token=ab\n')).toBe(
      'http://127.0.0.1:5123/?token=ab',
    )
  })
})

describe("a game's temp copy", () => {
  let source = ''
  afterEach(() => rmSync(source, { recursive: true, force: true }))

  it("holds the game's files, not its packages or builds, and goes when removed", () => {
    source = join(mkdtempSync(join(tmpdir(), 'af-game-')), 'game')
    for (const dir of ['content/levels', 'node_modules/vite', 'dist'])
      mkdirSync(join(source, dir), { recursive: true })
    writeFileSync(join(source, 'content/levels/a.af2d.json'), '{}')
    writeFileSync(join(source, 'node_modules/vite/index.js'), '')
    writeFileSync(join(source, 'dist/index.html'), '')
    const copy = copyGame(source)
    expect(existsSync(join(copy.dir, 'content/levels/a.af2d.json'))).toBe(true)
    expect(existsSync(join(copy.dir, 'node_modules'))).toBe(false)
    expect(existsSync(join(copy.dir, 'dist'))).toBe(false)
    copy.remove()
    expect(existsSync(copy.dir)).toBe(false)
  })
})
