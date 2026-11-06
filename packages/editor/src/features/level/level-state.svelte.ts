import { onDestroy } from 'svelte'
import type { History } from '../../shared/kit/history/history.ts'
import type { Camera } from '../../shared/level-2d/canvas/level-view'
import { projectHistory } from '../../shared/level-2d/editor/edit-history'
import type { EditHistory, LevelEditorView } from '../../shared/level-2d/editor/level-editor'
import type { Project } from '../../shared/level-2d/model/project-types'
import type { LevelSession } from './level-session'

// What a Level region draws from (plan EDS.2d step 2): the session's view and camera and the document, as Svelte state
// that follows them. Each region component calls this while it is set up and stops following when it goes, so the
// session outlives the regions (the suite keeps it across a switch, EDS-D12) and the standalone Level view alike.

export interface LevelState {
  readonly view: LevelEditorView
  readonly project: Project
  readonly camera: Camera | undefined
  /** The same history as the document's, typed for the level's edits. */
  readonly edits: EditHistory
}

export function levelState(session: LevelSession, history: History<unknown>): LevelState {
  const edits = projectHistory(history)
  // A session exists only over a level project (`createLevelSession`), so its history always has a project.
  if (edits === undefined) throw new TypeError('a level session over a document that is not a level project')
  let view = $state.raw(session.editor.view)
  let project = $state.raw(history.state as Project)
  let camera = $state.raw(session.camera)
  const stops = [
    session.editor.subscribe(() => (view = session.editor.view)),
    session.subscribe(() => (camera = session.camera)),
    history.subscribe(() => (project = history.state as Project)),
  ]
  onDestroy(() => {
    for (const stop of stops) stop()
  })
  return {
    get view() {
      return view
    },
    get project() {
      return project
    },
    get camera() {
      return camera
    },
    edits,
  }
}
