import { describe, expect, it } from 'vitest'
import { createHistory } from '#src/shared/kit/history/history.ts'
import { projectHistory } from '#src/shared/level-2d/editor/edit-history.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'

const rename = (name: string) => (project: Project) => ({ ...project, name })

describe('projectHistory', () => {
  it('applies, begins and commits on the document history as the kit does', () => {
    const history = createHistory<unknown>(platformerTemplate.create(counterIds()))
    const edits = projectHistory(history)
    if (edits === undefined) throw new Error('a project was refused')

    edits.apply('Rename', rename('one'))
    expect((history.state as Project).name).toBe('one')
    expect(history.undoLabel).toBe('Rename')

    const stroke = edits.begin('Paint')
    stroke.update(rename('two'))
    expect(edits.state.name).toBe('two')
    stroke.commit()
    expect(history.undoLabel).toBe('Paint')
    history.undo()
    expect(edits.state.name).toBe('one')
  })

  it('refuses a document that is not a level project', () => {
    expect(projectHistory(createHistory<unknown>({ stage: 'rooftops' }))).toBeUndefined()
    expect(projectHistory(createHistory<unknown>('text'))).toBeUndefined()
  })
})
