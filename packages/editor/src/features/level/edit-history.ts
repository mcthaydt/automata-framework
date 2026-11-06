import type { EditHistory } from '../../app/editor-2d/level-editor'
import type { History } from '../../shared/kit/history/history.ts'
import type { Project } from '../../shared/level-2d/model/project-types'

// The open document's history seen as the Level view's (plan ED2D.4c4a decision 2). The app holds every document as a
// `History<unknown>`, since it names no profile; the Level view is offered only by a profile whose value is a
// `Project`, so the value is one. A document that is not (a profile that names the Level view by mistake) gets no
// history, and the view says it cannot show the document instead of throwing in a pointer handler.

const isProject = (value: unknown): value is Project =>
  typeof value === 'object' && value !== null && Array.isArray((value as { levels?: unknown }).levels)

export function projectHistory(history: History<unknown>): EditHistory | undefined {
  if (!isProject(history.state)) return undefined
  const edit = (update: (project: Project) => Project) => (state: unknown) => update(state as Project)
  return {
    get state() {
      return history.state as Project
    },
    apply: (label, update) => history.apply(label, edit(update)),
    begin(label) {
      const transaction = history.begin(label)
      return {
        update: (update) => transaction.update(edit(update)),
        commit: () => transaction.commit(),
        cancel: () => transaction.cancel(),
      }
    },
  }
}
