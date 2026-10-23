import { describe, expect, it, vi } from 'vitest'
import { packTile } from '../model/cells-codec'
import { cellWord } from '../model/commands/cell-edits'
import { counterIds } from '../model/ids'
import { emptyLayers } from '../model/level-layers'
import type { Project } from '../model/project-types'
import { platformerTemplate } from '../profiles/level-project/templates/platformer'
import { createFakeHistory } from '../testing/fake-history'
import type { Point } from '../tiles/footprint'
import { lineCells } from '../tiles/footprint'
import { createLevelEditor } from './level-editor'

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
  it('starts on the first layer with the brush, size 1 and that layer’s default word', () => {
    const { editor } = setup()
    expect(editor.view).toMatchObject({
      level: 'level-1',
      layer: 'entities',
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
    editor.setLayer('entities')
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
    expect(editor.view.layer).toBe('entities')
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
