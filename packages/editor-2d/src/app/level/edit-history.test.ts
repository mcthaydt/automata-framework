import { createHistory } from '@mcthaydt/automata-editor-kit/core'
import { describe, expect, it } from 'vitest'
import { counterIds } from '../../model/ids'
import type { Project } from '../../model/project-types'
import { platformerTemplate } from '../../profiles/level-project/templates/platformer'
import { projectHistory } from './edit-history'

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
