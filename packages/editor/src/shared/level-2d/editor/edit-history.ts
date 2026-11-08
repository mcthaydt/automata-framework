import type { History } from '../../kit/history/history.ts'
import type { Project } from '../model/project-types'
import type { EditHistory } from './level-editor'

// The open document's history seen as the Level view's. The app holds every document as a
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
