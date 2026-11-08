import { describe, expect, it } from 'vitest'
import { createAppProfiles } from '#src/app/level-2d/profiles.ts'
import { levelGestures } from '#src/features/level/level-gestures.ts'
import { createLevelSession, type LevelSession } from '#src/features/level/level-session.ts'
import { createLevelDrawList } from '#src/shared/level-2d/canvas/draw/level-draw-list.ts'
import { createEditorApp, type OpenDocument } from '#src/shared/level-2d/documents/editor-app.ts'
import { packTile } from '#src/shared/level-2d/model/cells-codec.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'

// The Level view's acceptance cases in Node: the real profile,
// the kit's `History` and session, an in-memory workspace, and the session and gestures the Svelte view attaches. The
// platformer's `level-1` is 512 × 288 on a 16 px grid; the canvas is measured at the level's size, so the camera is
// 100 % with 24 px of padding.

const CANVAS = { w: 560, h: 336 }
const PAD = 24

async function setup() {
  const clock = createTestClock()
  const app = createEditorApp({
    workspace: memoryWorkspace(clock),
    registry: createAppProfiles(),
    ids: counterIds(),
    clock,
  })
  const outcome = await app.create('level-project', 'platformer')
  if (outcome.status !== 'opened') throw new Error(outcome.status)
  const document = outcome.document
  const session = createLevelSession({ history: document.history, ids: counterIds(500) })
  if (session === undefined) throw new Error('the platformer was refused')
  session.measure(CANVAS)
  const gestures = levelGestures(session, {
    onundo: () => document.history.undo(),
    onredo: () => document.history.redo(),
  })
  return { app, document, session, gestures }
}

const project = (document: OpenDocument): Project => document.history.state as Project

/** Taps the cell's centre on the canvas. */
function tapCell(session: LevelSession, cx: number, cy: number): void {
  session.editor.pointerDown({ x: cx * 16 + 8, y: cy * 16 + 8 })
  session.editor.pointerUp()
}

const keys = { shift: false, ctrl: false, alt: false, meta: false }
function penDrag(gestures: ReturnType<typeof levelGestures>, from: [number, number], to: [number, number]) {
  const screen = ([cx, cy]: [number, number]) => ({ x: PAD + cx * 16 + 8, y: PAD + cy * 16 + 8 })
  const [a, b] = [screen(from), screen(to)]
  const base = { pressure: 0.5, tiltX: 0, tiltY: 0, pointerType: 'pen' as const, button: 0, modifiers: keys }
  const sample = { ...base, startX: a.x, startY: a.y, dx: 0, dy: 0 }
  gestures.dragStart?.({ ...sample, x: a.x + 4, y: a.y, afterLongPress: false })
  gestures.drag?.({ ...sample, x: b.x, y: b.y })
  gestures.dragEnd?.({ ...sample, x: b.x, y: b.y, cancelled: false })
}

describe('Level view acceptance', () => {
  it('G-a: paint on three layers, place entities, save, and the re-opened project equals the saved one', async () => {
    const { app, document, session } = await setup()
    const { editor } = session

    editor.setLayer('collision')
    editor.setWord(1)
    for (const cx of [3, 4, 5]) tapCell(session, cx, 10)
    editor.setLayer('decor')
    editor.setWord(packTile(51, false, false))
    tapCell(session, 6, 8)
    editor.setLayer('ground')
    editor.setWord(packTile(2, false, false))
    tapCell(session, 4, 10)
    editor.setLayer('entities')
    editor.setEntityDef('slime')
    editor.pointerDown({ x: 200, y: 160 })
    editor.pointerUp()
    editor.setEntityDef('coin')
    editor.pointerDown({ x: 240, y: 120 })
    editor.pointerUp()

    const saved = project(document)
    const items = saved.levels[0]?.layers.find((layer) => layer.def === 'entities')
    expect(items?.kind === 'entities' ? items.items.map((item) => item.def) : []).toEqual(
      expect.arrayContaining(['player-start', 'slime', 'coin']),
    )
    expect((await document.save()).status).toBe('saved')
    const again = await app.open(document.path)
    if (again.status !== 'opened') throw new Error(again.status)
    expect(again.document.history.state).toEqual(saved)
  })

  it('G-c: painting IntGrid cells under the auto layer draws what a full recompute draws, in one undo step', async () => {
    const { document, session, gestures } = await setup()
    const view = () => ({ ...session.editor.view, hover: undefined })
    const drawer = createLevelDrawList()
    const input = () => ({ project: project(document), view: view(), images: new Set<string>() })
    drawer(input())

    session.editor.setLayer('collision')
    session.editor.setWord(1)
    const before = document.history.revision
    penDrag(gestures, [2, 6], [9, 6])
    expect(document.history.revision).toBe(before + 1)
    expect(document.history.undoLabel).toBe('Paint')

    const kept = drawer(input()).layers.find((layer) => layer.def === 'ground')
    const fresh = createLevelDrawList()(input()).layers.find((layer) => layer.def === 'ground')
    expect(kept).toEqual(fresh)
    expect(kept?.kind === 'auto' && kept.chunks.some((chunk) => chunk.tiles.length > 0)).toBe(true)
  })

  it('G-j: a pen stroke over cells is one undo step, and a two-finger tap undoes it', async () => {
    const { document, session, gestures } = await setup()
    session.editor.setLayer('collision')
    session.editor.setWord(3)
    const start = project(document)
    const before = document.history.revision

    penDrag(gestures, [1, 4], [5, 4])
    const layer = project(document).levels[0]?.layers.find((each) => each.def === 'collision')
    const row = layer?.kind === 'intgrid' ? [1, 2, 3, 4, 5].map((cx) => layer.cells.get(cx, 4)) : []
    expect(row).toEqual([3, 3, 3, 3, 3])
    expect(document.history.revision).toBe(before + 1)

    gestures.multiTap?.({ x: 100, y: 100, fingers: 2 })
    expect(project(document)).toBe(start)
  })
})
