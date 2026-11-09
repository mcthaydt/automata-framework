import { get, type Readable, readable } from 'svelte/store'
import { chooseLevel, levelName, pickerItems } from '../../../features/level/level-picker-model'
import type { EditorHeader } from '../../../shared/kit/ports/suite-editor.ts'
import { projectHistory } from '../../../shared/level-2d/model/edit-history'
import type { Project } from '../../../shared/level-2d/model/project-types'
import type { Levels2dSession, Levels2dView } from './levels-2d-session'

// What Levels 2D puts in the suite's breadcrumb: "Levels / Start ▾", the menu of the game's levels (open one, New
// level), and the views Level and Tiles beside it. The Level view names a level and the Tiles view names none, and the
// Characters view has neither (the rail is the way back to Levels), so the header never disagrees with the canvas. It is a
// store because what it says changes with the open level, the view and the game's levels, none of which are Svelte state.

const VIEWS: readonly { id: Levels2dView; label: string }[] = [
  { id: 'level', label: 'Level' },
  { id: 'tiles', label: 'Tiles' },
]

function headerOf(session: Levels2dSession): EditorHeader | undefined {
  const state = get(session.current)
  const view = get(session.view)
  if (state.kind !== 'open' || view === 'characters') return undefined
  const views = {
    label: 'Views',
    options: VIEWS,
    value: view,
    onchange: (id: string) => session.view.set(id === 'tiles' ? 'tiles' : 'level'),
  }
  if (view !== 'level') return { views }
  const project = state.history.state as Project
  const level = state.level.editor.view.level
  const items = pickerItems(project, level)
  if (items.length === 0) return { views }
  return {
    views,
    doc: {
      name: levelName(project, level),
      items,
      onselect: (id) => {
        const now = get(session.current)
        if (now.kind !== 'open') return
        const edits = projectHistory(now.history)
        if (edits === undefined) return
        chooseLevel(id, now.history.state as Project, now.level.editor.view.level, edits, (opened) => {
          now.level.editor.setLevel(opened)
          now.level.fit()
        })
      },
    },
  }
}

/** The key of what the header says, so a change that says nothing new (a pointer moving) does not redraw it. */
function keyOf(header: EditorHeader | undefined): string {
  return JSON.stringify(header, (_, value) => (typeof value === 'function' ? undefined : value))
}

export function levels2dHeader(session: Levels2dSession): Readable<EditorHeader | undefined> {
  return readable<EditorHeader | undefined>(undefined, (set) => {
    let said: string | undefined
    const publish = (): void => {
      const header = headerOf(session)
      const key = keyOf(header)
      if (key === said) return
      said = key
      set(header)
    }
    let stopOpen: (() => void) | undefined
    const stopCurrent = session.current.subscribe((state) => {
      stopOpen?.()
      const stops =
        state.kind === 'open' ? [state.history.subscribe(publish), state.level.editor.subscribe(publish)] : []
      stopOpen = () => {
        for (const stop of stops) stop()
      }
      publish()
    })
    const stopView = session.view.subscribe(publish)
    return () => {
      stopCurrent()
      stopOpen?.()
      stopView()
    }
  })
}
