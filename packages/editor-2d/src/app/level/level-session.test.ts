import { createHistory } from '@mcthaydt/automata-editor-kit/core'
import { describe, expect, it, vi } from 'vitest'
import { placeEntity } from '../../model/commands/entity-edits'
import { counterIds } from '../../model/ids'
import type { Project } from '../../model/project-types'
import { platformerTemplate } from '../../profiles/level-project/templates/platformer'
import { createLevelSession } from './level-session'

// The platformer's `level-1` is 512 × 288 px with a 16 px grid; `collision` is its IntGrid layer.

function setup() {
  const history = createHistory<unknown>(platformerTemplate.create(counterIds()))
  const session = createLevelSession({ history, ids: counterIds(100) })
  if (session === undefined) throw new Error('the platformer was refused')
  return { history, session }
}

describe('level session', () => {
  it('opens on the first level and has no camera until the canvas is measured', () => {
    const { session } = setup()
    expect(session.editor.view.level).toBe('level-1')
    expect(session.camera).toBeUndefined()
  })

  it('fits the level, centred, inside 24 px on the first measure', () => {
    const { session } = setup()
    session.measure({ w: 560, h: 336 })
    // (560 - 48) / 512 = 1 and (336 - 48) / 288 = 1: the level at 100 %, centred.
    expect(session.camera).toEqual({ x: 24, y: 24, scale: 1 })
  })

  it('keeps the centre on a resize and fits again on request', () => {
    const { session } = setup()
    session.measure({ w: 560, h: 336 })
    session.measure({ w: 760, h: 336 })
    expect(session.camera).toEqual({ x: 124, y: 24, scale: 1 })
    session.zoomAt({ x: 380, y: 168 }, 2)
    session.fit()
    expect(session.camera?.scale).toBe((336 - 48) / 288)
  })

  it('pans and zooms the camera without touching the history', () => {
    const { history, session } = setup()
    session.measure({ w: 560, h: 336 })
    const revision = history.revision
    session.panBy(10, -5)
    expect(session.camera).toEqual({ x: 34, y: 19, scale: 1 })
    session.zoomAt({ x: 34, y: 19 }, 2)
    expect(session.camera).toEqual({ x: 34, y: 19, scale: 2 })
    expect(history.revision).toBe(revision)
  })

  it('turns screen points into level pixels through the camera', () => {
    const { session } = setup()
    session.measure({ w: 560, h: 336 })
    session.zoomAt({ x: 24, y: 24 }, 2)
    expect(session.toLevel({ x: 24 + 64, y: 24 + 32 })).toEqual({ x: 32, y: 16 })
  })

  it('tells its subscribers when the camera moves', () => {
    const { session } = setup()
    const run = vi.fn()
    const stop = session.subscribe(run)
    session.measure({ w: 560, h: 336 })
    session.panBy(1, 1)
    expect(run).toHaveBeenCalledTimes(2)
    stop()
    session.panBy(1, 1)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('drops a selected instance the history no longer has', () => {
    const { history, session } = setup()
    session.editor.setLayer('entities')
    session.editor.setEntityDef('coin')
    session.editor.pointerDown({ x: 100, y: 100 })
    session.editor.pointerUp()
    expect(session.editor.view.selected).toHaveLength(1)
    history.undo()
    expect(session.editor.view.selected).toEqual([])
  })

  it('stops following the history once disposed', () => {
    const { history, session } = setup()
    session.editor.setLayer('entities')
    session.editor.setEntityDef('coin')
    session.editor.pointerDown({ x: 100, y: 100 })
    session.editor.pointerUp()
    session.dispose()
    history.undo()
    expect(session.editor.view.selected).toHaveLength(1)
  })

  it('refuses a document that is not a level project', () => {
    expect(createLevelSession({ history: createHistory<unknown>({}), ids: counterIds() })).toBeUndefined()
    const empty = { ...platformerTemplate.create(counterIds()), levels: [] } satisfies Project
    expect(createLevelSession({ history: createHistory<unknown>(empty), ids: counterIds() })).toBeUndefined()
  })
})

describe('level session focus', () => {
  it('starts on the focused level and layer with the instance selected', () => {
    const project = placeEntity(
      platformerTemplate.create(counterIds()),
      { level: 'level-1', layer: 'entities' },
      { id: 'slime-a', def: 'slime', x: 32, y: 48 },
    )
    const history = createHistory<unknown>(project)
    const session = createLevelSession({
      history,
      ids: counterIds(100),
      focus: { level: 'level-1', layer: 'entities', item: 'slime-a' },
    })
    expect(session?.editor.view).toMatchObject({ level: 'level-1', layer: 'entities', selected: ['slime-a'] })
  })
})
