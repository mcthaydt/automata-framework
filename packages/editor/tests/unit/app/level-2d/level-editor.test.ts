import { describe, expect, it, vi } from 'vitest'
import { createLevelEditor } from '#src/features/level/level-editor.ts'
import { packTile } from '#src/shared/level-2d/model/cells-codec.ts'
import { cellWord } from '#src/shared/level-2d/model/commands/cell-edits.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { emptyLayers } from '#src/shared/level-2d/model/level-layers.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'
import { topdownRpgTemplate } from '#src/shared/level-2d/profiles/level-project/templates/topdown-rpg.ts'
import type { Point } from '#src/shared/level-2d/tiles/footprint.ts'
import { lineCells } from '#src/shared/level-2d/tiles/footprint.ts'
import { createFakeHistory } from '#src/testing/level-2d/fake-history.ts'
import { entity, withEntities } from '#src/testing/level-2d/project-edit.ts'

// The platformer template: one 512 × 288 level `level-1` on a 16 px grid with layers, front to back, `entities`,
// `decor` (tiles), `ground` (auto, from `collision`) and `collision` (IntGrid 1 to 5).

function setup(layer?: string) {
  const history = createFakeHistory(platformerTemplate.create(counterIds()))
  const editor = createLevelEditor({
    history,
    ids: counterIds(100),
    level: 'level-1',
    ...(layer === undefined ? {} : { layer }),
  })
  return { history, editor }
}

describe('level editor: state', () => {
  it('starts on the ground, never on a character: the brush, size 1 and the first value of the collision layer', () => {
    const { editor } = setup()
    expect(editor.view).toMatchObject({
      level: 'level-1',
      layer: 'collision',
      word: 1,
      tool: 'brush',
      brushSize: 1,
      selected: [],
      hover: undefined,
      gesture: 'idle',
      rectangle: undefined,
    })
    expect(editor.view.entityDef).toBe('player-start')
  })

  it('starts on the layer it is given, with the first value of an IntGrid layer', () => {
    const { editor } = setup('collision')
    expect(editor.view.layer).toBe('collision')
    expect(editor.view.word).toBe(1)
  })

  it('refuses a level or a layer the project does not have', () => {
    const { editor, history } = setup()
    expect(() => editor.setLevel('nowhere')).toThrow(new RangeError('no level "nowhere"'))
    expect(() => editor.setLayer('sky')).toThrow(new RangeError('no layer "sky"'))
    expect(() => createLevelEditor({ history, ids: counterIds(), level: 'nowhere' })).toThrow(RangeError)
    expect(() => createLevelEditor({ history, ids: counterIds(), level: 'level-1', layer: 'sky' })).toThrow(
      RangeError,
    )
  })

  it('picks a word for a tiles layer: tile 0', () => {
    const { editor } = setup('decor')
    expect(editor.view.word).toBe(packTile(0, false, false))
  })

  it('remembers the palette word of each layer, and starts a layer on its default', () => {
    const { editor } = setup('collision')
    editor.setWord(4)
    editor.setLayer('decor')
    expect(editor.view.word).toBe(packTile(0, false, false))
    editor.setWord(packTile(7, true, false))
    editor.setLayer('collision')
    expect(editor.view.word).toBe(4)
    editor.setLayer('decor')
    expect(editor.view.word).toBe(packTile(7, true, false))
    editor.setLayer('ground')
    expect(editor.view.word).toBe(packTile(0, false, false))
  })

  it('picks the first entity definition for an entities layer when none is chosen, and keeps a chosen one', () => {
    const { editor } = setup('collision')
    editor.setLayer('entities')
    expect(editor.view.entityDef).toBe('player-start')
    editor.setEntityDef('slime')
    editor.setLayer('decor')
    editor.setLayer('entities')
    expect(editor.view.entityDef).toBe('slime')
  })

  it('refuses an entity definition the project does not have', () => {
    const { editor } = setup()
    expect(() => editor.setEntityDef('dragon')).toThrow(new RangeError('no entity definition "dragon"'))
  })

  it('rounds and clamps the brush size to 1 to 8', () => {
    const { editor } = setup()
    editor.setBrushSize(3.4)
    expect(editor.view.brushSize).toBe(3)
    editor.setBrushSize(99)
    expect(editor.view.brushSize).toBe(8)
    editor.setBrushSize(-2)
    expect(editor.view.brushSize).toBe(1)
    expect(() => editor.setBrushSize(Number.NaN)).toThrow(RangeError)
  })

  it('tells subscribers about each change once, and nothing for a setter that changes nothing', () => {
    const { editor } = setup()
    const heard = vi.fn()
    editor.subscribe(heard)
    editor.setTool('fill')
    expect(heard).toHaveBeenCalledTimes(1)
    editor.setTool('fill')
    editor.setBrushSize(1)
    editor.setLayer('collision')
    expect(heard).toHaveBeenCalledTimes(1)
    editor.setBrushSize(2)
    expect(heard).toHaveBeenCalledTimes(2)
  })

  it('stops telling a subscriber that unsubscribed', () => {
    const { editor } = setup()
    const heard = vi.fn()
    const stop = editor.subscribe(heard)
    stop()
    editor.setTool('fill')
    expect(heard).not.toHaveBeenCalled()
  })

  it('locks and hides layers, as sets, and notifies', () => {
    const { editor } = setup()
    const heard = vi.fn()
    editor.subscribe(heard)
    editor.setLocked('ground', true)
    editor.setHidden('decor', true)
    expect([...editor.view.locked]).toEqual(['ground'])
    expect([...editor.view.hidden]).toEqual(['decor'])
    editor.setLocked('ground', true)
    expect(heard).toHaveBeenCalledTimes(2)
    editor.setLocked('ground', false)
    editor.setHidden('decor', false)
    expect(editor.view.locked.size + editor.view.hidden.size).toBe(0)
  })

  it('refuses to lock or hide a layer the project does not have', () => {
    const { editor } = setup()
    expect(() => editor.setLocked('sky', true)).toThrow(RangeError)
    expect(() => editor.setHidden('sky', true)).toThrow(RangeError)
  })

  it('follows the pointer with the cell under it, and forgets it when the pointer leaves', () => {
    const { editor } = setup('collision')
    editor.pointerMove({ x: 40, y: 33 })
    expect(editor.view.hover).toEqual({ x: 2, y: 2 })
    editor.pointerMove({ x: 15.9, y: 0 })
    expect(editor.view.hover).toEqual({ x: 0, y: 0 })
    editor.pointerMove({ x: -1, y: -17 })
    expect(editor.view.hover).toEqual({ x: -1, y: -2 })
    editor.pointerLeave()
    expect(editor.view.hover).toBeUndefined()
  })

  it('tells subscribers about the hover only when the cell under the pointer changes', () => {
    const { editor } = setup('collision')
    const heard = vi.fn()
    editor.subscribe(heard)
    editor.pointerMove({ x: 20, y: 20 })
    editor.pointerMove({ x: 30, y: 25 })
    expect(heard).toHaveBeenCalledTimes(1)
    editor.pointerMove({ x: 40, y: 25 })
    expect(heard).toHaveBeenCalledTimes(2)
    editor.pointerLeave()
    editor.pointerLeave()
    expect(heard).toHaveBeenCalledTimes(3)
  })

  it('moving the pointer without a gesture changes nothing else', () => {
    const { editor, history } = setup('collision')
    editor.pointerMove({ x: 40, y: 40 })
    expect(history.steps).toEqual([])
    expect(history.begun).toBe(0)
  })

  it('switches level, which clears the selection', () => {
    const history = createFakeHistory(extraLevel(platformerTemplate.create(counterIds())))
    const editor = createLevelEditor({ history, ids: counterIds(100), level: 'level-1' })
    editor.setLevel('level-2')
    expect(editor.view.level).toBe('level-2')
    expect(editor.view.layer).toBe('collision')
  })
})

function extraLevel(project: Project): Project {
  const first = project.levels[0]
  if (first === undefined) throw new Error('no level')
  return { ...project, levels: [...project.levels, { ...first, id: 'level-2', name: 'Level 2' }] }
}

// The pixel at the middle of a cell of the 16 px grid.
const at = (x: number, y: number): Point => ({ x: x * 16 + 8, y: y * 16 + 8 })
const word = (project: Project, layer: string, x: number, y: number): number =>
  cellWord(project, { level: 'level-1', layer }, { x, y })

describe('level editor: strokes on cell layers', () => {
  it('paints under the pointer live, and commits one Paint step on release', () => {
    const { editor, history } = setup('collision')
    editor.pointerDown(at(2, 2))
    expect(editor.view.gesture).toBe('stroke')
    expect(word(history.state, 'collision', 2, 2)).toBe(1)
    expect(history.steps).toEqual([])
    editor.pointerMove(at(4, 2))
    expect([2, 3, 4].map((x) => word(history.state, 'collision', x, 2))).toEqual([1, 1, 1])
    expect(history.steps).toEqual([])
    editor.pointerUp()
    expect(history.steps.map((step) => step.label)).toEqual(['Paint'])
    expect(editor.view.gesture).toBe('idle')
    expect(history.open).toBe(false)
  })

  it('leaves no gap in a fast drag: the line between two pointer events is painted', () => {
    const { editor, history } = setup('collision')
    editor.pointerDown(at(0, 0))
    editor.pointerMove(at(9, 4))
    editor.pointerUp()
    for (const cell of lineCells({ x: 0, y: 0 }, { x: 9, y: 4 }))
      expect(word(history.state, 'collision', cell.x, cell.y), `${cell.x},${cell.y}`).toBe(1)
    expect(history.steps).toHaveLength(1)
  })

  it('follows a bent path: each move is a line from the last cell, not from where the stroke began', () => {
    const { editor, history } = setup('collision')
    editor.pointerDown(at(2, 2))
    editor.pointerMove(at(6, 2))
    editor.pointerMove(at(6, 6))
    editor.pointerUp()
    expect([2, 3, 4, 5, 6].map((x) => word(history.state, 'collision', x, 2))).toEqual([1, 1, 1, 1, 1])
    expect([3, 4, 5, 6].map((y) => word(history.state, 'collision', 6, y))).toEqual([1, 1, 1, 1])
    expect(word(history.state, 'collision', 3, 3)).toBe(0)
    expect(word(history.state, 'collision', 4, 4)).toBe(0)
  })

  it('paints the brush footprint at every cell of a moving stroke', () => {
    const { editor, history } = setup('collision')
    editor.setBrushSize(2)
    editor.pointerDown(at(2, 2))
    editor.pointerMove(at(6, 2))
    editor.pointerUp()
    for (let x = 2; x <= 7; x++)
      for (const y of [2, 3]) expect(word(history.state, 'collision', x, y), `${x},${y}`).toBe(1)
    expect(word(history.state, 'collision', 8, 2)).toBe(0)
    expect(word(history.state, 'collision', 4, 4)).toBe(0)
  })

  it('uses the brush size as it is when the pointer moves', () => {
    const { editor, history } = setup('collision')
    editor.pointerDown(at(2, 2))
    editor.setBrushSize(3)
    editor.pointerMove(at(5, 2))
    editor.pointerUp()
    expect(word(history.state, 'collision', 5, 3)).toBe(1)
    expect(word(history.state, 'collision', 3, 2)).toBe(1)
  })

  it('reads cells from the grid of the layer, not a fixed 16', () => {
    const base = platformerTemplate.create(counterIds())
    const layers = base.defs.layers.map((def) => (def.id === 'collision' ? { ...def, grid: 8 } : def))
    const defs = { ...base.defs, layers }
    const level = base.levels[0]
    if (level === undefined) throw new Error('no level')
    const project: Project = {
      ...base,
      defs,
      levels: [{ ...level, layers: emptyLayers(defs.layers, level.size) }],
    }
    const history = createFakeHistory(project)
    const editor = createLevelEditor({ history, ids: counterIds(100), level: 'level-1', layer: 'collision' })
    editor.pointerMove({ x: 20, y: 36 })
    expect(editor.view.hover).toEqual({ x: 2, y: 4 })
    editor.pointerDown({ x: 20, y: 36 })
    editor.pointerUp()
    expect(cellWord(history.state, { level: 'level-1', layer: 'collision' }, { x: 2, y: 4 })).toBe(1)
    expect(cellWord(history.state, { level: 'level-1', layer: 'collision' }, { x: 1, y: 2 })).toBe(0)
  })

  it('paints the brush footprint at every cell of the stroke', () => {
    const { editor, history } = setup('collision')
    editor.setBrushSize(2)
    editor.pointerDown(at(5, 5))
    editor.pointerUp()
    for (const [x, y] of [
      [5, 5],
      [6, 5],
      [5, 6],
      [6, 6],
    ] as const)
      expect(word(history.state, 'collision', x, y)).toBe(1)
    expect(word(history.state, 'collision', 4, 5)).toBe(0)
    expect(word(history.state, 'collision', 7, 5)).toBe(0)
  })

  it('paints the palette word', () => {
    const { editor, history } = setup('collision')
    editor.setWord(4)
    editor.pointerDown(at(1, 1))
    editor.pointerUp()
    expect(word(history.state, 'collision', 1, 1)).toBe(4)
  })

  it('does nothing for a move that stays in the same cell', () => {
    const { editor, history } = setup('collision')
    editor.pointerDown(at(2, 2))
    const live = history.state
    editor.pointerMove({ x: 2 * 16 + 3, y: 2 * 16 + 12 })
    expect(history.state).toBe(live)
    editor.pointerUp()
  })

  it('erases with the eraser, whatever the palette word, as one Erase step', () => {
    const { editor, history } = setup('collision')
    editor.setTool('eraser')
    editor.pointerDown(at(8, 16))
    editor.pointerMove(at(10, 16))
    editor.pointerUp()
    expect([8, 9, 10, 11].map((x) => word(history.state, 'collision', x, 16))).toEqual([0, 0, 0, 1])
    expect(history.steps.map((step) => step.label)).toEqual(['Erase'])
  })

  it('drags a rectangle from where the pointer went down, shrinking when it moves back', () => {
    const { editor, history } = setup('collision')
    editor.setTool('rectangle')
    editor.pointerDown(at(2, 2))
    expect(editor.view.gesture).toBe('rectangle')
    expect(editor.view.rectangle).toEqual({ from: { x: 2, y: 2 }, to: { x: 2, y: 2 } })
    expect(word(history.state, 'collision', 2, 2)).toBe(1)
    editor.pointerMove(at(5, 4))
    expect(editor.view.rectangle).toEqual({ from: { x: 2, y: 2 }, to: { x: 5, y: 4 } })
    expect(word(history.state, 'collision', 5, 4)).toBe(1)
    editor.pointerMove(at(3, 3))
    expect(editor.view.rectangle).toEqual({ from: { x: 2, y: 2 }, to: { x: 3, y: 3 } })
    expect(word(history.state, 'collision', 5, 4)).toBe(0)
    expect(word(history.state, 'collision', 3, 3)).toBe(1)
    expect(history.steps).toEqual([])
    editor.pointerUp()
    expect(history.steps.map((step) => step.label)).toEqual(['Rectangle'])
    expect(editor.view.rectangle).toBeUndefined()
    expect(editor.view.gesture).toBe('idle')
  })

  it('drags a rectangle up and to the left of where it began', () => {
    const { editor, history } = setup('collision')
    editor.setTool('rectangle')
    editor.pointerDown(at(5, 5))
    editor.pointerMove(at(3, 4))
    editor.pointerUp()
    expect(word(history.state, 'collision', 3, 4)).toBe(1)
    expect(word(history.state, 'collision', 5, 5)).toBe(1)
    expect(word(history.state, 'collision', 6, 5)).toBe(0)
  })

  it('fills in one step on pointer down, without opening a transaction', () => {
    const { editor, history } = setup('collision')
    editor.setTool('fill')
    editor.setWord(2)
    editor.pointerDown(at(0, 0))
    expect(history.steps.map((step) => step.label)).toEqual(['Fill'])
    expect(history.begun).toBe(0)
    expect(word(history.state, 'collision', 0, 0)).toBe(2)
    expect(word(history.state, 'collision', 31, 15)).toBe(2)
    expect(word(history.state, 'collision', 0, 16)).toBe(1)
    expect(editor.view.gesture).toBe('idle')
  })

  it('picks the word under the pointer without a step, and keeps the word over an empty cell', () => {
    const { editor, history } = setup('collision')
    editor.setTool('picker')
    editor.setWord(3)
    editor.pointerDown(at(8, 16))
    expect(editor.view.word).toBe(1)
    editor.pointerDown(at(8, 2))
    expect(editor.view.word).toBe(1)
    expect(history.steps).toEqual([])
    expect(history.begun).toBe(0)
  })

  it('picks a flipped tile whole, and remembers it for that layer', () => {
    const { editor, history } = setup('decor')
    editor.setWord(packTile(5, true, false))
    editor.pointerDown(at(3, 3))
    editor.pointerUp()
    editor.setWord(packTile(1, false, false))
    editor.setTool('picker')
    editor.pointerDown(at(3, 3))
    expect(editor.view.word).toBe(packTile(5, true, false))
    editor.setLayer('collision')
    editor.setLayer('decor')
    expect(editor.view.word).toBe(packTile(5, true, false))
    expect(history.steps).toHaveLength(1)
  })

  it('cancel leaves the project as it was and records no step', () => {
    const { editor, history } = setup('collision')
    const before = history.state
    editor.pointerDown(at(2, 2))
    editor.pointerMove(at(6, 2))
    editor.cancel()
    expect(history.state).toBe(before)
    expect(history.steps).toEqual([])
    expect(editor.view.gesture).toBe('idle')
    expect(history.open).toBe(false)
  })

  it('cancel ends a rectangle and clears it', () => {
    const { editor, history } = setup('collision')
    editor.setTool('rectangle')
    editor.pointerDown(at(2, 2))
    editor.pointerMove(at(6, 6))
    editor.cancel()
    expect(editor.view.rectangle).toBeUndefined()
    expect(history.steps).toEqual([])
  })

  it('a stroke over cells that already hold the word records no step', () => {
    const { editor, history } = setup('collision')
    editor.pointerDown(at(8, 16))
    editor.pointerMove(at(10, 16))
    editor.pointerUp()
    expect(history.steps).toEqual([])
    expect(history.begun).toBe(1)
  })

  it('a second pointer down cancels the gesture the first one left open', () => {
    const { editor, history } = setup('collision')
    editor.pointerDown(at(2, 2))
    editor.pointerDown(at(5, 5))
    expect(word(history.state, 'collision', 2, 2)).toBe(0)
    expect(word(history.state, 'collision', 5, 5)).toBe(1)
    editor.pointerUp()
    expect(history.steps).toHaveLength(1)
  })

  it('a pointer up with nothing open does nothing', () => {
    const { editor, history } = setup('collision')
    editor.pointerUp()
    editor.cancel()
    expect(history.begun).toBe(0)
    expect(history.steps).toEqual([])
  })

  it('drops cells outside the level without complaint', () => {
    const { editor, history } = setup('collision')
    editor.pointerDown({ x: -50, y: -50 })
    editor.pointerMove({ x: -60, y: 9999 })
    editor.pointerUp()
    expect(history.steps).toEqual([])
  })

  it('keeps following the pointer with the hover during a stroke', () => {
    const { editor } = setup('collision')
    editor.pointerDown(at(2, 2))
    editor.pointerMove(at(7, 3))
    expect(editor.view.hover).toEqual({ x: 7, y: 3 })
    editor.pointerUp()
  })

  it('ignores a pointer down on a locked layer', () => {
    const { editor, history } = setup('collision')
    editor.setLocked('collision', true)
    editor.pointerDown(at(2, 2))
    expect(history.begun).toBe(0)
    expect(editor.view.gesture).toBe('idle')
  })

  it('ignores a pointer down on a hidden layer', () => {
    const { editor, history } = setup('collision')
    editor.setHidden('collision', true)
    editor.pointerDown(at(2, 2))
    expect(history.begun).toBe(0)
  })

  it('locking the layer during a stroke ends nothing by itself but the next stroke is refused', () => {
    const { editor, history } = setup('collision')
    editor.pointerDown(at(2, 2))
    editor.pointerUp()
    editor.setLocked('collision', true)
    editor.pointerDown(at(4, 4))
    expect(word(history.state, 'collision', 4, 4)).toBe(0)
  })

  it('the select tool does nothing on a cell layer yet', () => {
    const { editor, history } = setup('collision')
    editor.setTool('select')
    editor.pointerDown(at(2, 2))
    expect(history.begun).toBe(0)
    expect(editor.view.gesture).toBe('idle')
  })

  it('paints a tiles layer with the tile word, flips and all', () => {
    const { editor, history } = setup('decor')
    editor.setWord(packTile(5, false, true))
    editor.pointerDown(at(3, 3))
    editor.pointerUp()
    expect(word(history.state, 'decor', 3, 3)).toBe(packTile(5, false, true))
  })

  it('paints the overrides of an auto layer', () => {
    const { editor, history } = setup('ground')
    editor.setWord(packTile(2, false, false))
    editor.pointerDown(at(3, 3))
    editor.pointerUp()
    expect(word(history.state, 'ground', 3, 3)).toBe(packTile(2, false, false))
  })

  it('cancels its transaction when a command refuses the word, and lets the error out', () => {
    const { editor, history } = setup('collision')
    editor.setWord(9)
    expect(() => editor.pointerDown(at(2, 2))).toThrow(RangeError)
    expect(history.open).toBe(false)
    expect(editor.view.gesture).toBe('idle')
    expect(history.steps).toEqual([])
  })

  it('clears an open rectangle when the tool changes', () => {
    const { editor } = setup('collision')
    editor.setTool('rectangle')
    editor.pointerDown(at(2, 2))
    editor.setTool('brush')
    expect(editor.view.rectangle).toBeUndefined()
    expect(editor.view.gesture).toBe('idle')
  })

  it('changing the layer, level or tool cancels the gesture in progress', () => {
    const { editor, history } = setup('collision')
    const before = history.state
    editor.pointerDown(at(2, 2))
    editor.setLayer('decor')
    expect(history.state).toBe(before)
    expect(history.open).toBe(false)
    editor.setLayer('collision')
    editor.pointerDown(at(2, 2))
    editor.setTool('fill')
    expect(history.state).toBe(before)
    editor.setTool('brush')
    editor.pointerDown(at(2, 2))
    editor.setLevel('level-1')
    expect(history.state).toBe(before)
  })
})

// Entities: the platformer level has a `player-start` (single) at (48, 256), 16 × 24 on its pivot (0.5, 1), so it covers
// x 40 to 56 and y 232 to 256. `slime` is 16 × 12 on the same pivot; `coin` is 8 × 8 on its centre.

const items = (project: Project, layer = 'entities') => {
  const found = project.levels[0]?.layers.find((candidate) => candidate.def === layer)
  if (found?.kind !== 'entities') throw new Error(`no entities layer "${layer}"`)
  return found.items
}
const PLAYER = '00000001'

/** The platformer with its entities layer snapping or not, and `extra` entities added to the level. */
function entitySetup(options: { snap?: boolean; extra?: Parameters<typeof withEntities>[2] } = {}) {
  let project = platformerTemplate.create(counterIds())
  if (options.snap === false) {
    const layers = project.defs.layers.map((def) => (def.kind === 'entities' ? { ...def, snap: false } : def))
    project = { ...project, defs: { ...project.defs, layers } }
  }
  if (options.extra !== undefined) project = withEntities(project, 'level-1', options.extra)
  const history = createFakeHistory(project)
  const editor = createLevelEditor({ history, ids: counterIds(100), level: 'level-1', layer: 'entities' })
  return { history, editor }
}

describe('level editor: entities', () => {
  it('places the chosen definition at the pointer, snapped to the grid, and selects it', () => {
    const { editor, history } = entitySetup()
    editor.setEntityDef('slime')
    editor.pointerDown({ x: 100, y: 130 })
    const placed = items(history.state).at(-1)
    expect(placed).toMatchObject({ def: 'slime', x: 96, y: 128 })
    expect(editor.view.selected).toEqual([placed?.id])
    expect(history.steps.map((step) => step.label)).toEqual(['Place entity'])
    expect(history.begun).toBe(0)
    expect(editor.view.gesture).toBe('idle')
  })

  it('places at whole pixels when the layer does not snap', () => {
    const { editor, history } = entitySetup({ snap: false })
    editor.setEntityDef('slime')
    editor.pointerDown({ x: 100.4, y: 130.6 })
    expect(items(history.state).at(-1)).toMatchObject({ def: 'slime', x: 100, y: 131 })
  })

  it('moves the one instance of a single definition and selects it', () => {
    const { editor, history } = entitySetup()
    editor.setEntityDef('player-start')
    editor.pointerDown({ x: 200, y: 96 })
    expect(items(history.state)).toHaveLength(1)
    expect(items(history.state)[0]).toMatchObject({ id: PLAYER, x: 208, y: 96 })
    expect(editor.view.selected).toEqual([PLAYER])
    expect(history.steps.map((step) => step.label)).toEqual(['Place entity'])
  })

  it('finds the single instance in the level being edited', () => {
    const base = extraLevel(platformerTemplate.create(counterIds()))
    const project: Project = {
      ...base,
      levels: base.levels.map((level) =>
        level.id === 'level-2'
          ? {
              ...level,
              layers: level.layers.map((layer) =>
                layer.kind === 'entities'
                  ? { ...layer, items: [entity('player-two', 'player-start', 16, 16)] }
                  : layer,
              ),
            }
          : level,
      ),
    }
    const history = createFakeHistory(project)
    const editor = createLevelEditor({ history, ids: counterIds(100), level: 'level-2', layer: 'entities' })
    editor.setEntityDef('player-start')
    editor.pointerDown({ x: 200, y: 96 })
    expect(editor.view.selected).toEqual(['player-two'])
  })

  it('places a new instance of a definition that is not single, even when the level has one', () => {
    const { editor, history } = entitySetup({ extra: [entity('s1', 'slime', 120, 150)] })
    editor.setEntityDef('slime')
    editor.pointerDown({ x: 300, y: 100 })
    expect(items(history.state).filter((item) => item.def === 'slime')).toHaveLength(2)
    expect(editor.view.selected).not.toContain('s1')
    expect(editor.view.selected).toEqual([items(history.state).at(-1)?.id])
  })

  it('places nothing when the project defines no entities', () => {
    const base = platformerTemplate.create(counterIds())
    const history = createFakeHistory({ ...base, defs: { ...base.defs, entities: [] } })
    const editor = createLevelEditor({ history, ids: counterIds(100), level: 'level-1', layer: 'entities' })
    expect(editor.view.entityDef).toBeUndefined()
    editor.pointerDown({ x: 100, y: 100 })
    expect(history.steps).toEqual([])
    expect(history.begun).toBe(0)
  })

  it('selects the instance under the pointer with the select tool, and clears on empty ground', () => {
    const { editor, history } = entitySetup()
    editor.setTool('select')
    editor.pointerDown({ x: 48, y: 240 })
    editor.pointerUp()
    expect(editor.view.selected).toEqual([PLAYER])
    editor.pointerDown({ x: 300, y: 40 })
    expect(editor.view.selected).toEqual([])
    expect(editor.view.gesture).toBe('idle')
    expect(history.steps).toEqual([])
  })

  it('tells subscribers nothing when the select tool clears a selection that is already empty', () => {
    const { editor } = entitySetup()
    editor.setTool('select')
    const heard = vi.fn()
    editor.subscribe(heard)
    editor.pointerDown({ x: 300, y: 40 })
    editor.pointerDown({ x: 300, y: 40 })
    expect(heard).not.toHaveBeenCalled()
    editor.pointerDown({ x: 48, y: 240 })
    editor.pointerUp()
    editor.pointerDown({ x: 300, y: 40 })
    editor.pointerDown({ x: 300, y: 40 })
    expect(heard).toHaveBeenCalledTimes(3)
  })

  it('drags the picked instance by the pointer’s offset, snapped, live, and commits one Move entity', () => {
    const { editor, history } = entitySetup()
    editor.setTool('select')
    editor.pointerDown({ x: 50, y: 240 })
    expect(editor.view.gesture).toBe('move')
    editor.pointerMove({ x: 50 + 40, y: 240 + 7 })
    expect(items(history.state)[0]).toMatchObject({ x: 48 + 48, y: 256 })
    expect(history.steps).toEqual([])
    editor.pointerMove({ x: 50 + 40, y: 240 - 48 })
    editor.pointerUp()
    expect(items(history.state)[0]).toMatchObject({ x: 96, y: 208 })
    expect(history.steps.map((step) => step.label)).toEqual(['Move entity'])
    expect(editor.view.gesture).toBe('idle')
    expect(editor.view.selected).toEqual([PLAYER])
  })

  it('does not jump to the pointer: an off-grid instance keeps its offset from the grid', () => {
    const { editor, history } = entitySetup({ extra: [entity('coin-a', 'coin', 148, 222)] })
    editor.setTool('select')
    editor.pointerDown({ x: 150, y: 223 })
    expect(editor.view.selected).toEqual(['coin-a'])
    editor.pointerMove({ x: 150 + 33, y: 223 })
    editor.pointerUp()
    expect(items(history.state).find((item) => item.id === 'coin-a')).toMatchObject({ x: 148 + 32, y: 222 })
  })

  it('drags in whole pixels when the layer does not snap', () => {
    const { editor, history } = entitySetup({ snap: false })
    editor.setTool('select')
    editor.pointerDown({ x: 50, y: 240 })
    editor.pointerMove({ x: 50 + 5.4, y: 240 - 2.6 })
    editor.pointerUp()
    expect(items(history.state)[0]).toMatchObject({ x: 53, y: 253 })
  })

  it('records no step for a drag that ends where it began', () => {
    const { editor, history } = entitySetup()
    editor.setTool('select')
    editor.pointerDown({ x: 50, y: 240 })
    editor.pointerMove({ x: 50 + 64, y: 240 })
    editor.pointerMove({ x: 50 + 3, y: 240 })
    editor.pointerUp()
    expect(history.steps).toEqual([])
    expect(history.begun).toBe(1)
  })

  it('cancel puts a dragged instance back', () => {
    const { editor, history } = entitySetup()
    const before = history.state
    editor.setTool('select')
    editor.pointerDown({ x: 50, y: 240 })
    editor.pointerMove({ x: 150, y: 140 })
    editor.cancel()
    expect(history.state).toBe(before)
    expect(history.steps).toEqual([])
    expect(editor.view.selected).toEqual([PLAYER])
  })

  it('hits the topmost of two overlapping instances', () => {
    const { editor } = entitySetup({
      extra: [entity('coin-a', 'coin', 300, 100), entity('coin-b', 'coin', 302, 100)],
    })
    editor.setTool('select')
    editor.pointerDown({ x: 301, y: 100 })
    expect(editor.view.selected).toEqual(['coin-b'])
  })

  it('erases the instance under the pointer as Delete entity, and drops it from the selection', () => {
    const { editor, history } = entitySetup()
    editor.setTool('select')
    editor.pointerDown({ x: 50, y: 240 })
    editor.pointerUp()
    const begun = history.begun
    editor.setTool('eraser')
    editor.pointerDown({ x: 50, y: 240 })
    expect(items(history.state)).toEqual([])
    expect(editor.view.selected).toEqual([])
    expect(history.steps.map((step) => step.label)).toEqual(['Delete entity'])
    expect(history.begun).toBe(begun)
  })

  it('erasing one instance keeps the selection of another', () => {
    const { editor, history } = entitySetup({ extra: [entity('s1', 'slime', 120, 150)] })
    editor.setTool('select')
    editor.pointerDown({ x: 120, y: 146 })
    editor.pointerUp()
    editor.setTool('eraser')
    editor.pointerDown({ x: 50, y: 240 })
    expect(items(history.state).map((item) => item.id)).toEqual(['s1'])
    expect(editor.view.selected).toEqual(['s1'])
  })

  it('erasing empty ground records nothing and leaves the selection', () => {
    const { editor, history } = entitySetup()
    editor.setTool('select')
    editor.pointerDown({ x: 50, y: 240 })
    editor.pointerUp()
    editor.setTool('eraser')
    editor.pointerDown({ x: 300, y: 40 })
    expect(history.steps).toEqual([])
    expect(editor.view.selected).toEqual([PLAYER])
  })

  it('picks an instance with the picker: selects it and takes its definition', () => {
    const { editor, history } = entitySetup({ extra: [entity('s1', 'slime', 120, 150)] })
    editor.setTool('picker')
    editor.pointerDown({ x: 120, y: 146 })
    expect(editor.view.selected).toEqual(['s1'])
    expect(editor.view.entityDef).toBe('slime')
    editor.pointerDown({ x: 300, y: 40 })
    expect(editor.view.selected).toEqual(['s1'])
    expect(editor.view.entityDef).toBe('slime')
    expect(history.steps).toEqual([])
    expect(history.begun).toBe(0)
  })

  it('ignores a locked or hidden entities layer', () => {
    const { editor, history } = entitySetup()
    editor.setLocked('entities', true)
    editor.pointerDown({ x: 100, y: 100 })
    editor.setTool('select')
    editor.pointerDown({ x: 50, y: 240 })
    editor.setLocked('entities', false)
    editor.setHidden('entities', true)
    editor.pointerDown({ x: 50, y: 240 })
    expect(history.steps).toEqual([])
    expect(editor.view.selected).toEqual([])
  })

  it('rectangle, fill and brush drags do nothing more on an entities layer', () => {
    const { editor, history } = entitySetup()
    for (const tool of ['rectangle', 'fill'] as const) {
      editor.setTool(tool)
      editor.pointerDown({ x: 100, y: 100 })
      editor.pointerMove({ x: 140, y: 140 })
      editor.pointerUp()
    }
    expect(history.steps).toEqual([])
    expect(history.begun).toBe(0)
    editor.setTool('brush')
    editor.pointerDown({ x: 100, y: 100 })
    editor.pointerMove({ x: 200, y: 200 })
    editor.pointerUp()
    expect(history.steps).toHaveLength(1)
  })

  it('refresh drops the selected ids the project no longer has, and says nothing when none went', () => {
    const { editor, history } = entitySetup({ extra: [entity('s1', 'slime', 120, 150)] })
    editor.setTool('picker')
    editor.pointerDown({ x: 120, y: 146 })
    const heard = vi.fn()
    editor.subscribe(heard)
    editor.refresh()
    expect(heard).not.toHaveBeenCalled()
    history.apply('Delete entity', (project) => withoutItem(project, 's1'))
    editor.refresh()
    expect(editor.view.selected).toEqual([])
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it('select sets the selection to the ids the level has (the Checks tab, a duplicate)', () => {
    const { editor } = entitySetup({ extra: [entity('s1', 'slime', 120, 150)] })
    editor.select(['s1', 'gone'])
    expect(editor.view.selected).toEqual(['s1'])
    editor.select([])
    expect(editor.view.selected).toEqual([])
  })

  it('refresh looks at the level being edited', () => {
    const base = extraLevel(platformerTemplate.create(counterIds()))
    const project = withEntities(base, 'level-2', [entity('only-in-two', 'coin', 100, 100)])
    const history = createFakeHistory(project)
    const editor = createLevelEditor({ history, ids: counterIds(100), level: 'level-2', layer: 'entities' })
    editor.setTool('picker')
    editor.pointerDown({ x: 100, y: 100 })
    expect(editor.view.selected).toEqual(['only-in-two'])
    editor.refresh()
    expect(editor.view.selected).toEqual(['only-in-two'])
  })

  it('switching layer or level clears the selection', () => {
    const history = createFakeHistory(extraLevel(platformerTemplate.create(counterIds())))
    const editor = createLevelEditor({ history, ids: counterIds(100), level: 'level-1', layer: 'entities' })
    editor.setTool('select')
    editor.pointerDown({ x: 48, y: 240 })
    editor.pointerUp()
    expect(editor.view.selected).toEqual([PLAYER])
    editor.setLayer('collision')
    expect(editor.view.selected).toEqual([])
    editor.setLayer('entities')
    editor.pointerDown({ x: 48, y: 240 })
    editor.pointerUp()
    editor.setLevel('level-2')
    expect(editor.view.selected).toEqual([])
  })
})

function withoutItem(project: Project, id: string): Project {
  return {
    ...project,
    levels: project.levels.map((level) => ({
      ...level,
      layers: level.layers.map((layer) =>
        layer.kind === 'entities' ? { ...layer, items: layer.items.filter((item) => item.id !== id) } : layer,
      ),
    })),
  }
}

// Objects: the top-down template's level `map-1` has a `props` objects layer on the `overworld` tileset, free-placed.

const objectItems = (project: Project) => {
  const found = project.levels[0]?.layers.find((candidate) => candidate.def === 'props')
  if (found?.kind !== 'objects') throw new Error('no props layer')
  return found.items
}

function objectSetup(snap = 0) {
  const base = topdownRpgTemplate.create(counterIds())
  const layers = base.defs.layers.map((def) => (def.kind === 'objects' ? { ...def, snap } : def))
  const history = createFakeHistory({ ...base, defs: { ...base.defs, layers } })
  const editor = createLevelEditor({ history, ids: counterIds(100), level: 'map-1', layer: 'props' })
  return { history, editor }
}

describe('level editor: objects', () => {
  it('places an object of the palette tile at the pointer in whole pixels, as one Place object step', () => {
    const { editor, history } = objectSetup()
    editor.setWord(packTile(26, false, false))
    editor.pointerDown({ x: 100.4, y: 50.6 })
    expect(objectItems(history.state)).toEqual([
      { id: '0000002s', tile: 26, x: 100, y: 51, flipX: false, flipY: false },
    ])
    expect(history.steps.map((step) => step.label)).toEqual(['Place object'])
    expect(history.begun).toBe(0)
    expect(editor.view.gesture).toBe('idle')
    expect(editor.view.selected).toEqual([])
  })

  it('takes the flips from the palette word', () => {
    const { editor, history } = objectSetup()
    editor.setWord(packTile(3, true, true))
    editor.pointerDown({ x: 10, y: 20 })
    expect(objectItems(history.state)[0]).toMatchObject({ tile: 3, flipX: true, flipY: true })
    editor.setWord(packTile(3, true, false))
    editor.pointerDown({ x: 30, y: 20 })
    expect(objectItems(history.state)[1]).toMatchObject({ flipX: true, flipY: false })
  })

  it('places the first tile of the set from the start', () => {
    const { editor, history } = objectSetup()
    editor.pointerDown({ x: 10, y: 20 })
    expect(objectItems(history.state)[0]).toMatchObject({ tile: 0 })
  })

  it('snaps to the layer’s snap size when it has one', () => {
    const { editor, history } = objectSetup(8)
    editor.pointerDown({ x: 29, y: 13 })
    expect(objectItems(history.state)[0]).toMatchObject({ x: 32, y: 16 })
  })

  it('places nothing for the empty word', () => {
    const { editor, history } = objectSetup()
    editor.setWord(0)
    editor.pointerDown({ x: 10, y: 20 })
    expect(history.steps).toEqual([])
  })

  it('lets the error out when the tile is beyond the tileset, and records nothing', () => {
    const { editor, history } = objectSetup()
    editor.setWord(packTile(9999, false, false))
    expect(() => editor.pointerDown({ x: 10, y: 20 })).toThrow(RangeError)
    expect(history.steps).toEqual([])
    expect(history.open).toBe(false)
  })

  it('leaves selecting, erasing and the cell tools to a later slice', () => {
    const { editor, history } = objectSetup()
    editor.pointerDown({ x: 10, y: 20 })
    const placed = history.steps.length
    for (const tool of ['select', 'eraser', 'picker', 'rectangle', 'fill'] as const) {
      editor.setTool(tool)
      editor.pointerDown({ x: 10, y: 20 })
      editor.pointerMove({ x: 60, y: 60 })
      editor.pointerUp()
    }
    expect(history.steps).toHaveLength(placed)
    expect(history.begun).toBe(0)
    expect(objectItems(history.state)).toHaveLength(1)
  })

  it('ignores a locked objects layer', () => {
    const { editor, history } = objectSetup()
    editor.setLocked('props', true)
    editor.pointerDown({ x: 10, y: 20 })
    expect(history.steps).toEqual([])
  })
})
