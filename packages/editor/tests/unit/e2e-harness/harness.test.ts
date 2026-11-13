// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cellCentre, parseCamera } from '../../e2e/harness/canvas-pointer.ts'
import { linkGamePackages } from '../../e2e/harness/link-game-packages.ts'
import { printedAddress, printedPlayOff } from '../../e2e/harness/run-editor.ts'
import { runGame } from '../../e2e/harness/run-game.ts'
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
    expect(printedAddress('Opened g in the level editor.\n')).toBeUndefined()
    expect(
      printedAddress('Opened g in the level editor.\n  This computer: http://127.0.0.1:5123/?token=ab\n'),
    ).toBe('http://127.0.0.1:5123/?token=ab')
  })

  it('says why Play is off, when the command printed that', () => {
    expect(
      printedPlayOff('  Your game is running: http://localhost:5200/\nPress Ctrl+C to stop.\n'),
    ).toBeUndefined()
    expect(
      printedPlayOff(
        '  This computer: http://127.0.0.1:5123/\n  Play is off: Cannot find module x.\nPress Ctrl+C to stop.\n',
      ),
    ).toBe('Cannot find module x.')
  })
})

describe("a game's dev server that stops", () => {
  let folder = ''
  afterEach(() => rmSync(folder, { recursive: true, force: true }))

  it('fails the journey at once, with what the server said', async () => {
    folder = mkdtempSync(join(tmpdir(), 'af-run-game-'))
    mkdirSync(join(folder, 'node_modules/vite/bin'), { recursive: true })
    writeFileSync(join(folder, 'package.json'), '{"type":"module"}')
    writeFileSync(join(folder, 'node_modules/vite/package.json'), '{"name":"vite","version":"0.0.0"}')
    writeFileSync(
      join(folder, 'node_modules/vite/bin/vite.js'),
      'console.error("Error: Cannot find module \'@automata/feel\'"); process.exit(1)',
    )
    const started = Date.now()
    await expect(runGame(folder, folder, 6999)).rejects.toThrow(
      /exited with 1[\s\S]*Cannot find module '@automata\/feel'/,
    )
    expect(Date.now() - started).toBeLessThan(10_000)
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

describe('the packages a new game is linked to', () => {
  let root = ''
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  /** A folder with a workspace (`packages/*`), a game that is installed (`games/base`), and a generated game. */
  function layout(generated: object): { generated: string; installed: string; workspace: string } {
    root = mkdtempSync(join(tmpdir(), 'af-link-'))
    const write = (path: string, json: object) => {
      mkdirSync(join(root, path), { recursive: true })
      writeFileSync(join(root, path, 'package.json'), JSON.stringify(json))
    }
    writeFileSync(
      join(root, 'pnpm-workspace.yaml'),
      'packages:\n  - packages/*\n  - games/*\nsaveExact: true\n',
    )
    write('packages/core', { name: '@automata/core' })
    write('packages/polish', { name: '@automata/polish' })
    write('games/base', { name: '@af-games/base' })
    // The installed game has core and one outside package, and no polish: the case that rotted.
    write('games/base/node_modules/@automata/core', { name: '@automata/core' })
    write('games/base/node_modules/vite', { name: 'vite' })
    mkdirSync(join(root, 'out/game'), { recursive: true })
    writeFileSync(join(root, 'out/game/package.json'), JSON.stringify(generated))
    return { generated: join(root, 'out/game'), installed: join(root, 'games/base'), workspace: root }
  }

  it('is each package the generated game names: workspace ones from the workspace, the rest from the installed game', () => {
    const where = layout({
      dependencies: { '@automata/core': '^0.0.5', '@automata/polish': '^0.0.5', vite: '8.3.3' },
    })
    linkGamePackages(where.generated, where.installed, where.workspace)
    const linked = (name: string) => realpathSync(join(where.generated, 'node_modules', name))
    expect(linked('@automata/polish')).toBe(realpathSync(join(where.workspace, 'packages/polish')))
    expect(linked('@automata/core')).toBe(realpathSync(join(where.workspace, 'packages/core')))
    expect(linked('vite')).toBe(realpathSync(join(where.installed, 'node_modules/vite')))
  })

  it('names a needed package it cannot find, and leaves a missing tool alone', () => {
    const missing = layout({ dependencies: { 'not-anywhere': '1.0.0' } })
    expect(() => linkGamePackages(missing.generated, missing.installed, missing.workspace)).toThrow(
      /not-anywhere/,
    )
    const tool = layout({ devDependencies: { typescript: '7.0.2' } })
    expect(() => linkGamePackages(tool.generated, tool.installed, tool.workspace)).not.toThrow()
  })
})
